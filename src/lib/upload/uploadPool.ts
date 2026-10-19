import { UploadError, isHaltingError, isRetryableError, toUploadError } from './uploadErrors';

export type PoolJobStatus = 'queued' | 'uploading' | 'retrying' | 'success' | 'error' | 'cancelled';
export type PoolState = 'idle' | 'running' | 'paused' | 'done' | 'cancelled' | 'halted';

export interface PoolJob<T, R = unknown> {
  id: string;
  item: T;
  status: PoolJobStatus;
  /** Tentativas feitas na última execução deste job. */
  attempts: number;
  /** Repetições automáticas já feitas (0..maxRetries). */
  retries: number;
  error?: UploadError;
  result?: R;
}

export interface PoolCounts {
  total: number;
  queued: number;
  inFlight: number;
  success: number;
  error: number;
  cancelled: number;
}

export interface UploadPoolOptions<T, R> {
  upload: (item: T, signal: AbortSignal) => Promise<R>;
  /** Envios simultâneos. Padrão 3. */
  concurrency?: number;
  /** Repetições automáticas para erros transitórios. Padrão 3. */
  maxRetries?: number;
  /** Espera antes da repetição n (1-based), em ms. */
  backoff?: (retry: number) => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  onChange?: () => void;
  onSuccess?: (job: PoolJob<T, R>) => void;
  /** Chamado quando o lote é interrompido por termos não aceitos ou sessão expirada. */
  onHalt?: (error: UploadError) => void;
}

export const defaultBackoff = (retry: number): number => Math.min(8000, 1000 * 2 ** (retry - 1)) + Math.floor(Math.random() * 250);

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Pool de envio com N workers reais: cada worker pega o próximo job assim que
 * termina o anterior (não espera o mais lento de um bloco).
 *
 * - pause(): para de despachar novos envios; os que estão em andamento terminam.
 * - cancel(): aborta os envios em andamento e marca a fila como cancelada.
 * - Erro "terms"/"auth": interrompe o lote; os jobs não enviados voltam para a fila.
 */
export class UploadPool<T, R = unknown> {
  private readonly opts: Required<Omit<UploadPoolOptions<T, R>, 'onChange' | 'onSuccess' | 'onHalt'>> &
    Pick<UploadPoolOptions<T, R>, 'onChange' | 'onSuccess' | 'onHalt'>;
  private jobs: PoolJob<T, R>[] = [];
  private _state: PoolState = 'idle';
  private controller = new AbortController();
  private stopped = false;
  private cancelled = false;
  private paused = false;
  private resumeWaiters: Array<() => void> = [];
  private runPromise: Promise<void> | null = null;
  private finishRun: (() => void) | null = null;
  private activeWorkers = 0;
  private _haltError: UploadError | null = null;

  constructor(options: UploadPoolOptions<T, R>) {
    this.opts = {
      concurrency: 3,
      maxRetries: 3,
      backoff: defaultBackoff,
      sleep: abortableSleep,
      ...options,
    };
  }

  get state(): PoolState {
    return this._state;
  }

  get haltError(): UploadError | null {
    return this._haltError;
  }

  getJobs(): readonly PoolJob<T, R>[] {
    return this.jobs;
  }

  getJob(id: string): PoolJob<T, R> | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  counts(): PoolCounts {
    const c: PoolCounts = { total: this.jobs.length, queued: 0, inFlight: 0, success: 0, error: 0, cancelled: 0 };
    for (const j of this.jobs) {
      if (j.status === 'queued') c.queued++;
      else if (j.status === 'uploading' || j.status === 'retrying') c.inFlight++;
      else if (j.status === 'success') c.success++;
      else if (j.status === 'error') c.error++;
      else if (j.status === 'cancelled') c.cancelled++;
    }
    return c;
  }

  add(items: Array<{ id: string; item: T }>): void {
    for (const { id, item } of items) {
      if (this.jobs.some((j) => j.id === id)) continue;
      this.jobs.push({ id, item, status: 'queued', attempts: 0, retries: 0 });
    }
    this.emit();
  }

  /** Remove jobs que não estão em andamento. */
  remove(ids: string[]): void {
    const set = new Set(ids);
    this.jobs = this.jobs.filter((j) => !set.has(j.id) || j.status === 'uploading' || j.status === 'retrying');
    this.emit();
  }

  /** Inicia (ou continua) o envio da fila. Resolve quando não há mais nada a fazer. */
  run(): Promise<void> {
    if (this.runPromise) {
      // Um lote interrompido ainda está encerrando: começa de novo quando terminar.
      if (this.stopped) return this.runPromise.then(() => this.run());
      this.spawnWorkers();
      return this.runPromise;
    }
    this.stopped = false;
    this.cancelled = false;
    this.paused = false;
    this._haltError = null;
    this.controller = new AbortController();
    this._state = 'running';
    this.runPromise = new Promise<void>((resolve) => {
      this.finishRun = resolve;
    });
    this.emit();
    this.spawnWorkers();
    if (this.activeWorkers === 0) this.onWorkersDone();
    return this.runPromise;
  }

  /** Abre workers até o limite de concorrência (ou até o número de jobs na fila). */
  private spawnWorkers(): void {
    const queued = this.jobs.filter((j) => j.status === 'queued').length;
    const wanted = Math.min(this.opts.concurrency, this.activeWorkers + queued);
    while (this.activeWorkers < wanted) {
      this.activeWorkers++;
      void this.worker().finally(() => {
        this.activeWorkers--;
        if (this.activeWorkers === 0) this.onWorkersDone();
      });
    }
  }

  private onWorkersDone(): void {
    const finish = this.finishRun;
    this.finishRun = null;
    this.runPromise = null;
    if (this.cancelled) this._state = 'cancelled';
    else if (this._haltError) this._state = 'halted';
    else this._state = 'done';
    this.emit();
    finish?.();
  }

  pause(): void {
    if (this._state !== 'running') return;
    this.paused = true;
    this._state = 'paused';
    this.emit();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this._state = 'running';
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
    this.emit();
  }

  cancel(): void {
    this.cancelled = true;
    this.stopped = true;
    this.controller.abort();
    for (const j of this.jobs) {
      if (j.status === 'queued') j.status = 'cancelled';
    }
    this.paused = false;
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
    if (!this.runPromise) this._state = 'cancelled';
    this.emit();
  }

  /**
   * Volta para a fila os jobs com erro (ou cancelados) indicados — ou todos, sem ids —
   * e retoma o envio se o pool estiver parado.
   */
  retry(ids?: string[]): Promise<void> {
    const set = ids ? new Set(ids) : null;
    for (const j of this.jobs) {
      if ((j.status === 'error' || j.status === 'cancelled') && (!set || set.has(j.id))) {
        j.status = 'queued';
        j.error = undefined;
        j.retries = 0;
        j.attempts = 0;
      }
    }
    this.emit();
    return this.run();
  }

  private emit(): void {
    this.opts.onChange?.();
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => this.resumeWaiters.push(resolve));
  }

  private async worker(): Promise<void> {
    for (;;) {
      if (this.stopped) return;
      if (this.paused) {
        await this.waitForResume();
        continue;
      }
      const job = this.jobs.find((j) => j.status === 'queued');
      if (!job) return;
      await this.process(job);
    }
  }

  private async process(job: PoolJob<T, R>): Promise<void> {
    job.status = 'uploading';
    job.attempts = 0;
    job.retries = 0;
    job.error = undefined;
    this.emit();
    const signal = this.controller.signal;

    for (;;) {
      if (this.stopped) {
        job.status = this.cancelled ? 'cancelled' : 'queued';
        this.emit();
        return;
      }
      job.attempts++;
      try {
        const result = await this.opts.upload(job.item, signal);
        job.result = result;
        job.status = 'success';
        job.error = undefined;
        this.emit();
        this.opts.onSuccess?.(job);
        return;
      } catch (raw) {
        const err = toUploadError(raw);
        if (err.kind === 'aborted' || this.stopped) {
          job.status = this.cancelled ? 'cancelled' : 'queued';
          this.emit();
          return;
        }
        if (isHaltingError(err)) {
          job.status = 'queued';
          job.error = err;
          this.halt(err);
          return;
        }
        if (isRetryableError(err) && job.retries < this.opts.maxRetries) {
          job.retries++;
          job.status = 'retrying';
          job.error = err;
          this.emit();
          await this.opts.sleep(this.opts.backoff(job.retries), signal);
          continue;
        }
        job.status = 'error';
        job.error = err;
        this.emit();
        return;
      }
    }
  }

  private halt(err: UploadError): void {
    if (this.stopped) return;
    this._haltError = err;
    this.stopped = true;
    this.controller.abort();
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
    this.emit();
    this.opts.onHalt?.(err);
  }
}
