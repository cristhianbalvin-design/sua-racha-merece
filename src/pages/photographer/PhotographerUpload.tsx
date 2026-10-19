import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, FolderOpen, Pause, Play, Upload, XCircle } from 'lucide-react';
import { usePhotographer } from '@/hooks/usePhotographer';
import { apiGetRegionsWithId, apiGetSportsWithId, apiGetUniqueCities } from '@/lib/mockApi';
import { apiGetMyPhotoCities, photographerUploader } from '@/lib/photographerApi';
import { ACCEPT_ATTRIBUTE, classifyFile, effectiveMimeType, fileKey, formatBytes, isImageFile, type FileClass } from '@/lib/upload/fileClassification';
import { readExifDate } from '@/lib/upload/exif';
import { resolvePhotoDate, summarizeExifDates } from '@/lib/upload/eventDate';
import { UploadPool } from '@/lib/upload/uploadPool';
import type { EventUploadFields, UploadedPhoto } from '@/lib/upload/edgeUpload';
import { SentRegistry, getSafeLocalStorage, sentRegistryKey } from '@/lib/upload/sentRegistry';
import { collectDroppedFiles, collectInputFiles, type CollectedFile } from '@/lib/upload/dropFiles';
import { formatIsoDate, todayIso } from '@/lib/photoStatus';
import { useConfirm } from '@/hooks/useConfirm';
import EventDataForm from '@/components/photographer/EventDataForm';
import UploadQueueList from '@/components/photographer/UploadQueueList';
import type { QueueRowData, RowView } from '@/lib/upload/queueView';

const CONCURRENCY = 3;
type Mode = 'individual' | 'massa';

interface UploadRow {
  id: string;
  file: File;
  relativePath: string;
  klass: FileClass;
  /** undefined = lendo; null = sem data EXIF */
  exifDate: string | null | undefined;
  skipped: boolean;
}

interface UploadItem {
  rowId: string;
  file: File;
  fields: EventUploadFields;
}

const EMPTY_FIELDS: EventUploadFields = { region_id: '', sport_id: '', city: '', event_date: '' };

const validateFields = (f: EventUploadFields): Partial<Record<keyof EventUploadFields, string>> => {
  const e: Partial<Record<keyof EventUploadFields, string>> = {};
  if (!f.region_id) e.region_id = 'Selecione a região.';
  if (!f.sport_id) e.sport_id = 'Selecione o esporte.';
  if (!f.city.trim()) e.city = 'Informe a cidade.';
  if (!f.event_date) e.event_date = 'Informe a data do evento.';
  else if (f.event_date > todayIso()) e.event_date = 'A data não pode estar no futuro.';
  return e;
};

let rowCounter = 0;

const PhotographerUpload = () => {
  const [confirm, confirmDialog] = useConfirm();
  const { profile, refresh } = usePhotographer();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('individual');
  const [fields, setFields] = useState<EventUploadFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<keyof EventUploadFields, string>>>({});
  const [useFormDateForAll, setUseFormDateForAll] = useState(false);
  const [skipSent, setSkipSent] = useState(true);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [ignoredNonImages, setIgnoredNonImages] = useState(0);
  const [folderName, setFolderName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [, setVersion] = useState(0);
  const dateAutofilled = useRef(false);
  const runStats = useRef<{ startedAt: number; doneAtStart: number }>({ startedAt: 0, doneAtStart: 0 });
  const registryRef = useRef<SentRegistry | null>(null);
  const storageWarned = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Re-render limitado a 1x por frame quando o pool muda.
  const frame = useRef<number | null>(null);
  const bump = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setVersion((v) => v + 1);
    });
  }, []);

  const handleHalt = useRef<(kind: string) => void>(() => {});
  const poolRef = useRef<UploadPool<UploadItem, UploadedPhoto> | null>(null);
  if (!poolRef.current) {
    poolRef.current = new UploadPool<UploadItem, UploadedPhoto>({
      concurrency: CONCURRENCY,
      maxRetries: 3,
      upload: (item, signal) => {
        // A função valida o MIME do arquivo; alguns navegadores deixam o tipo vazio ou usam "image/jpg".
        const mime = effectiveMimeType(item.file);
        const file = item.file.type === mime ? item.file : new File([item.file], item.file.name, { type: mime });
        return photographerUploader(file, item.file.name, item.fields, signal);
      },
      onChange: bump,
      onSuccess: (job) => {
        const ok = registryRef.current?.add(fileKey(job.item.file));
        if (ok === false && !storageWarned.current) {
          storageWarned.current = true;
          toast.warning('Este navegador não deixou salvar a lista de fotos enviadas. "Pular fotos já enviadas" pode não funcionar.');
        }
      },
      onHalt: (err) => handleHalt.current(err.kind),
    });
  }
  const pool = poolRef.current;

  handleHalt.current = (kind: string) => {
    if (kind === 'terms') {
      toast.error('Você precisa aceitar os Termos do Fotógrafo. O envio foi interrompido.');
      refresh().finally(() => navigate('/fotografo/termos', { replace: true }));
    } else if (kind === 'auth') {
      setSessionExpired(true);
      toast.error('Sua sessão expirou. O envio foi interrompido.');
    }
  };

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    poolRef.current?.cancel();
  }, []);

  useEffect(() => {
    apiGetRegionsWithId().then(setRegions).catch(console.error);
    apiGetSportsWithId().then(setSports).catch(console.error);
    const own = profile ? apiGetMyPhotoCities(profile.id).catch(() => [] as string[]) : Promise.resolve([] as string[]);
    Promise.all([apiGetUniqueCities().catch(() => [] as string[]), own]).then(([a, b]) =>
      setCities(Array.from(new Set([...b, ...a])).sort((x, y) => x.localeCompare(y, 'pt-BR'))),
    );
  }, [profile]);

  const folderInputCallback = useCallback((el: HTMLInputElement | null) => {
    folderInputRef.current = el;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  const state = pool.state;
  const isActive = state === 'running' || state === 'paused';
  const counts = pool.counts();

  // Aviso ao fechar a aba durante o envio.
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isActive]);

  // ---- Arquivos ----

  const readExifFor = useCallback(async (newRows: UploadRow[]) => {
    const targets = newRows.filter((r) => r.exifDate === undefined);
    let i = 0;
    const results = new Map<string, string | null>();
    const flush = () => {
      if (!results.size) return;
      const snapshot = new Map(results);
      results.clear();
      setRows((prev) => prev.map((r) => (snapshot.has(r.id) ? { ...r, exifDate: snapshot.get(r.id)! } : r)));
    };
    const worker = async () => {
      while (i < targets.length) {
        const r = targets[i++];
        results.set(r.id, await readExifDate(r.file));
        if (results.size >= 25) flush();
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    flush();
  }, []);

  const addFiles = useCallback(
    (collected: CollectedFile[], replace: boolean) => {
      const images = collected.filter((c) => isImageFile(c.file));
      const nonImages = collected.length - images.length;
      setIgnoredNonImages((n) => (replace ? nonImages : n + nonImages));
      const existing = replace ? new Set<string>() : new Set(rows.map((r) => `${r.relativePath}|${r.file.size}`));
      const newRows: UploadRow[] = [];
      for (const c of images) {
        const key = `${c.relativePath}|${c.file.size}`;
        if (existing.has(key)) continue;
        existing.add(key);
        const klass = classifyFile(c.file);
        newRows.push({
          id: `r${++rowCounter}`,
          file: c.file,
          relativePath: c.relativePath,
          klass,
          exifDate: klass === 'valid' ? undefined : null,
          skipped: false,
        });
      }
      if (replace) {
        poolRef.current?.remove(poolRef.current.getJobs().map((j) => j.id));
        setRows(newRows);
      } else {
        setRows((prev) => [...prev, ...newRows]);
      }
      if (nonImages > 0 && images.length === 0) toast.info('Nenhuma imagem encontrada.');
      void readExifFor(newRows);
    },
    [rows, readExifFor],
  );

  const handleFilesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(collectInputFiles(e.target.files), false);
    e.target.value = '';
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const collected = collectInputFiles(e.target.files);
    e.target.value = '';
    if (!collected.length) return;
    setFolderName(collected[0].relativePath.split('/')[0] || 'Pasta');
    addFiles(collected, true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isActive) return;
    try {
      const { files, hadFolder } = await collectDroppedFiles(e.dataTransfer);
      if (mode === 'massa') {
        if (files.length) setFolderName(hadFolder ? files[0].relativePath.split('/')[0] : `${files.length} arquivos soltos`);
        addFiles(files, true);
      } else {
        addFiles(files, false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível ler os arquivos soltos. Use o botão de escolher.');
    }
  };

  const clearQueue = () => {
    if (isActive) return;
    pool.remove(pool.getJobs().map((j) => j.id));
    setRows([]);
    setFolderName('');
    setIgnoredNonImages(0);
  };

  const switchMode = async (next: Mode) => {
    if (next === mode || isActive) return;
    if (rows.length && !(await confirm({ description: 'Trocar o modo de envio limpa a fila atual. Continuar?', confirmLabel: 'Continuar' }))) return;
    clearQueue();
    setMode(next);
  };

  // ---- Datas EXIF ----

  const validRows = useMemo(() => rows.filter((r) => r.klass === 'valid'), [rows]);
  const exifSummary = useMemo(() => summarizeExifDates(validRows.map((r) => r.exifDate)), [validRows]);

  useEffect(() => {
    if (dateAutofilled.current || fields.event_date || !exifSummary.mostCommon) return;
    if (exifSummary.mostCommon > todayIso()) return;
    dateAutofilled.current = true;
    setFields((f) => (f.event_date ? f : { ...f, event_date: exifSummary.mostCommon! }));
  }, [exifSummary.mostCommon, fields.event_date]);

  // ---- "Pular já enviadas" ----

  const registryKey = profile && fields.region_id && fields.sport_id && fields.city.trim() && fields.event_date
    ? sentRegistryKey(profile.id, fields)
    : null;
  const storedRegistry = useMemo(
    () => (registryKey ? new SentRegistry(getSafeLocalStorage(), registryKey) : null),
    [registryKey],
  );
  // Durante/depois de um envio, o registro em uso já tem as fotos recém-enviadas.
  const previewRegistry = registryRef.current && registryRef.current.key === registryKey ? registryRef.current : storedRegistry;
  const alreadySentCount =
    skipSent && previewRegistry
      ? validRows.filter((r) => !pool.getJob(r.id) && previewRegistry.has(fileKey(r.file))).length
      : 0;

  // ---- Envio ----

  const markRunStart = () => {
    const c = pool.counts();
    runStats.current = { startedAt: Date.now(), doneAtStart: c.success + c.error };
  };

  const pendingRows = validRows.filter((r) => {
    const job = pool.getJob(r.id);
    return !job || job.status === 'queued' || job.status === 'error' || job.status === 'cancelled';
  });

  const startUpload = async () => {
    if (isActive) return;
    const errs = validateFields(fields);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Preencha os dados do evento antes de enviar.');
      return;
    }
    if (exifSummary.checked < exifSummary.total) {
      toast.info('Aguarde: ainda estamos lendo as datas das fotos.');
      return;
    }
    if (!profile) return;
    setSessionExpired(false);

    const ev: EventUploadFields = { ...fields, city: fields.city.trim() };
    registryRef.current = new SentRegistry(getSafeLocalStorage(), sentRegistryKey(profile.id, ev));
    const today = todayIso();

    const toAdd: Array<{ id: string; item: UploadItem }> = [];
    const skippedIds = new Set<string>();
    for (const r of validRows) {
      const job = pool.getJob(r.id);
      if (job && (job.status === 'success' || job.status === 'uploading' || job.status === 'retrying')) continue;
      if (skipSent && !job && registryRef.current.has(fileKey(r.file))) {
        skippedIds.add(r.id);
        continue;
      }
      const item: UploadItem = {
        rowId: r.id,
        file: r.file,
        fields: { ...ev, event_date: resolvePhotoDate(r.exifDate, ev.event_date, useFormDateForAll, today) },
      };
      if (job) {
        // Quem estava na fila, com erro ou cancelado volta para a fila com os dados atuais do evento.
        job.item = item;
        job.status = 'queued';
        job.error = undefined;
        job.retries = 0;
      } else {
        toAdd.push({ id: r.id, item });
      }
    }
    setRows((prev) => prev.map((r) => (skippedIds.has(r.id) ? { ...r, skipped: true } : r)));
    pool.add(toAdd);

    if (pool.counts().queued === 0) {
      toast.info(skippedIds.size ? 'Todas as fotos já tinham sido enviadas.' : 'Não há fotos para enviar.');
      return;
    }
    markRunStart();
    await pool.run();
    const c = pool.counts();
    if (pool.state === 'done') {
      if (c.error) toast.warning(`Envio concluído: ${c.success} enviadas, ${c.error} com erro.`);
      else toast.success(`Envio concluído: ${c.success} fotos enviadas para aprovação.`);
    } else if (pool.state === 'cancelled') {
      toast.info('Lote cancelado.');
    }
  };

  const retryOne = (id: string) => {
    const p = pool.retry([id]);
    markRunStart();
    void p;
  };
  const retryAll = () => {
    const ids = pool.getJobs().filter((j) => j.status === 'error' && j.error?.kind === 'transient').map((j) => j.id);
    if (!ids.length) return;
    const p = pool.retry(ids);
    markRunStart();
    void p;
  };

  const removeRow = (id: string) => {
    pool.remove([id]);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // ---- Visão das linhas ----

  const jobMap = new Map(pool.getJobs().map((j) => [j.id, j]));
  const queueRows: QueueRowData[] = rows.map((r) => {
    let view: RowView;
    if (r.klass === 'unsupported') view = { kind: 'unsupported' };
    else if (r.klass === 'too_large') view = { kind: 'too_large' };
    else {
      const job = jobMap.get(r.id);
      if (job) {
        view = {
          kind: 'job',
          status: job.status,
          retries: job.retries,
          error: job.error?.message,
          retryable: job.error?.kind === 'transient' || job.error?.kind === 'unknown' || job.status === 'cancelled',
        };
      } else if (r.skipped) view = { kind: 'skipped' };
      else view = { kind: 'ready' };
    }
    return { id: r.id, name: r.relativePath, size: r.file.size, exifDate: r.exifDate, view };
  });

  const retryableCount = pool.getJobs().filter((j) => j.status === 'error' && j.error?.kind === 'transient').length;
  const unsupportedCount = rows.filter((r) => r.klass === 'unsupported').length;
  const tooLargeCount = rows.filter((r) => r.klass === 'too_large').length;
  const totalBytes = rows.reduce((s, r) => s + r.file.size, 0);

  const jobsTotal = counts.total;
  const finished = counts.success + counts.error + counts.cancelled;
  const percent = jobsTotal ? Math.round((finished / jobsTotal) * 100) : 0;
  const remaining = counts.queued + counts.inFlight;
  let etaText = '';
  if (state === 'running' && remaining > 0) {
    const done = counts.success + counts.error - runStats.current.doneAtStart;
    const elapsed = (Date.now() - runStats.current.startedAt) / 1000;
    if (done >= 3 && elapsed > 5) {
      const mins = Math.max(1, Math.round(((elapsed / done) * remaining) / 60));
      etaText = ` · cerca de ${mins} min restantes`;
    }
  }

  const sendCount = Math.max(0, pendingRows.length - alreadySentCount);
  const locked = isActive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold italic text-2xl text-foreground">Enviar fotos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === 'individual'
            ? 'Preencha os dados do evento e adicione as fotos do lote.'
            : 'Escolha a pasta do evento e envie tudo de uma vez.'}
        </p>
      </div>

      <div className="inline-flex p-1 bg-muted/60 rounded-2xl gap-1" role="tablist" aria-label="Modo de envio">
        {([
          ['individual', 'Individual'],
          ['massa', 'Em massa · pasta completa'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            disabled={locked}
            onClick={() => switchMode(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
              mode === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sessionExpired && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            Sua sessão expirou e o envio foi interrompido. Entre de novo; ao voltar, escolha as mesmas fotos — as já enviadas serão puladas.
          </p>
          <button
            type="button"
            onClick={() => navigate('/fotografo/login', { state: { from: '/fotografo/enviar' } })}
            className="bg-primary text-primary-foreground text-ui text-xs px-4 py-2.5 rounded-xl font-bold shrink-0"
          >
            ENTRAR NOVAMENTE
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {/* Seleção de arquivos */}
          {mode === 'individual' || rows.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); if (!locked) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/10' : 'border-border bg-card'
              } ${locked ? 'opacity-60' : ''}`}
            >
              {mode === 'individual' ? <Upload className="mx-auto text-muted-foreground" size={28} /> : <FolderOpen className="mx-auto text-muted-foreground" size={28} />}
              <p className="font-bold text-foreground mt-3">
                {mode === 'individual' ? 'Arraste as fotos aqui' : 'Arraste a pasta do evento aqui'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG ou WEBP · até 20 MB por foto</p>
              <div className="mt-4">
                {mode === 'individual' ? (
                  <button type="button" disabled={locked} onClick={() => fileInputRef.current?.click()} className="bg-secondary text-secondary-foreground text-ui text-xs px-5 py-2.5 rounded-xl font-bold disabled:opacity-50">
                    ESCOLHER ARQUIVOS
                  </button>
                ) : (
                  <button type="button" disabled={locked} onClick={() => folderInputRef.current?.click()} className="bg-secondary text-secondary-foreground text-ui text-xs px-5 py-2.5 rounded-xl font-bold disabled:opacity-50">
                    ESCOLHER PASTA
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl card-shadow p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen className="text-primary shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{folderName || 'Pasta'}</p>
                    <p className="text-xs text-muted-foreground">{rows.length} arquivos · {formatBytes(totalBytes)}</p>
                  </div>
                </div>
                <button type="button" disabled={locked} onClick={() => folderInputRef.current?.click()} className="text-xs font-bold text-primary hover:underline disabled:opacity-50 shrink-0">
                  Trocar pasta
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary font-bold">{validRows.length} válidas</span>
                {unsupportedCount > 0 && <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive font-bold">{unsupportedCount} formato não suportado</span>}
                {tooLargeCount > 0 && <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive font-bold">{tooLargeCount} acima de 20 MB</span>}
                {ignoredNonImages > 0 && <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{ignoredNonImages} arquivos que não são imagens ignorados</span>}
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} className="hidden" onChange={handleFilesInput} />
          <input ref={folderInputCallback} type="file" multiple className="hidden" onChange={handleFolderInput} />

          {/* Progresso */}
          {jobsTotal > 0 && (
            <div className="bg-card rounded-2xl card-shadow p-4 space-y-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-foreground text-sm">
                  {state === 'running' && `Enviando… ${finished} de ${jobsTotal}`}
                  {state === 'paused' && `Pausado · ${finished} de ${jobsTotal}`}
                  {state === 'done' && `Concluído · ${finished} de ${jobsTotal}`}
                  {state === 'cancelled' && `Lote cancelado · ${counts.success} enviadas`}
                  {state === 'halted' && `Envio interrompido · ${counts.success} enviadas`}
                  {state === 'idle' && `${jobsTotal} na fila`}
                </p>
                <span className="text-sm font-bold text-primary">{percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="text-primary font-bold">{counts.success} enviadas</span>
                <span className="text-destructive font-bold">{counts.error} com erro</span>
                <span className="text-muted-foreground">{counts.queued + counts.inFlight} na fila</span>
                {counts.cancelled > 0 && <span className="text-muted-foreground">{counts.cancelled} canceladas</span>}
              </div>
              {isActive && (
                <>
                  <p className="text-xs text-muted-foreground">{CONCURRENCY} envios ao mesmo tempo{etaText}</p>
                  <div className="flex flex-wrap gap-2">
                    {state === 'running' ? (
                      <button type="button" onClick={() => pool.pause()} className="inline-flex items-center gap-1.5 bg-muted text-foreground text-xs font-bold px-4 py-2 rounded-xl">
                        <Pause size={14} /> Pausar
                      </button>
                    ) : (
                      <button type="button" onClick={() => pool.resume()} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl">
                        <Play size={14} /> Continuar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => { if (await confirm({ description: 'Cancelar o lote? As fotos já enviadas continuam enviadas.', confirmLabel: 'Cancelar lote', cancelLabel: 'Voltar', destructive: true })) pool.cancel(); }}
                      className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive text-xs font-bold px-4 py-2 rounded-xl"
                    >
                      <XCircle size={14} /> Cancelar lote
                    </button>
                  </div>
                  <p className="text-xs text-accent flex items-start gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    Mantenha esta página aberta até terminar. Se ela fechar, escolha as mesmas fotos de novo e as já enviadas serão puladas (neste navegador).
                  </p>
                </>
              )}
            </div>
          )}

          <UploadQueueList
            title={`Fila de envio · ${rows.length} ${rows.length === 1 ? 'arquivo' : 'arquivos'}`}
            rows={queueRows}
            busy={locked}
            onRemove={removeRow}
            onRetry={retryOne}
            onRetryAll={retryAll}
            retryableCount={retryableCount}
          />
        </div>

        {/* Dados do evento + ações */}
        <div className="space-y-4 lg:sticky lg:top-28">
          <EventDataForm
            value={fields}
            onChange={(f) => { setFields(f); setErrors({}); }}
            disabled={locked}
            regions={regions}
            sports={sports}
            cities={cities}
            errors={errors}
            subtitle={mode === 'individual' ? 'Valem para todas as fotos deste lote.' : 'Valem para todas as fotos da pasta. Bloqueados durante o envio.'}
          >
            {validRows.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-2 rounded-lg bg-muted/50 p-3">
                {exifSummary.checked < exifSummary.total ? (
                  <p>Lendo a data das fotos… {exifSummary.checked} de {exifSummary.total}</p>
                ) : (
                  <p>
                    Lemos a data em {exifSummary.withDate} de {exifSummary.total} fotos
                    {exifSummary.byDate.length > 0 && (
                      <>: {exifSummary.byDate.slice(0, 3).map((d) => `${formatIsoDate(d.date)} (${d.count})`).join(', ')}{exifSummary.byDate.length > 3 ? '…' : ''}</>
                    )}
                    .{' '}
                    {useFormDateForAll
                      ? 'Todas usam a data acima.'
                      : exifSummary.total - exifSummary.withDate > 0
                        ? `As ${exifSummary.total - exifSummary.withDate} sem data usam a data acima.`
                        : 'Cada foto usa a sua própria data.'}
                  </p>
                )}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={useFormDateForAll} onChange={(e) => setUseFormDateForAll(e.target.checked)} disabled={locked} />
                  <span>Usar a data do formulário para todas (se o relógio da câmera estava errado)</span>
                </label>
              </div>
            )}
            <label className="flex items-start gap-2 cursor-pointer text-xs text-foreground">
              <input type="checkbox" className="mt-0.5" checked={skipSent} onChange={(e) => setSkipSent(e.target.checked)} disabled={locked} />
              <span>
                Pular fotos já enviadas (mesmo nome e tamanho)
                <span className="block text-muted-foreground">
                  Só reconhece envios feitos neste navegador, com os mesmos dados do evento.
                  {alreadySentCount > 0 && ` ${alreadySentCount} serão puladas.`}
                </span>
              </span>
            </label>
          </EventDataForm>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={startUpload}
              disabled={locked || sendCount === 0}
              className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow font-bold disabled:opacity-50"
            >
              {locked ? 'ENVIO EM ANDAMENTO' : sendCount === 1 ? 'ENVIAR 1 FOTO' : `ENVIAR ${sendCount} FOTOS`}
            </button>
            {mode === 'individual' && rows.length > 0 && (
              <button type="button" onClick={clearQueue} disabled={locked} className="w-full bg-muted text-foreground text-ui text-xs py-3 rounded-xl font-bold disabled:opacity-50">
                LIMPAR FILA
              </button>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};

export default PhotographerUpload;
