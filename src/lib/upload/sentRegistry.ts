/**
 * Registro local (localStorage) das fotos já enviadas com sucesso, por fotógrafo + evento.
 * Serve para "Pular fotos já enviadas" ao escolher a mesma pasta de novo.
 * Só funciona no mesmo navegador; qualquer falha de armazenamento é ignorada.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SentRegistryEvent {
  region_id: string;
  sport_id: string;
  city: string;
  event_date: string;
}

const PREFIX = '3buk:fotografo:enviadas:';

export const sentRegistryKey = (photographerId: string, ev: SentRegistryEvent): string =>
  `${PREFIX}${photographerId}|${ev.region_id}|${ev.sport_id}|${ev.city.trim().toLowerCase()}|${ev.event_date}`;

export const getSafeLocalStorage = (): StorageLike | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export class SentRegistry {
  private keys: Set<string>;

  constructor(private readonly storage: StorageLike | null, private readonly storageKey: string) {
    this.keys = new Set(this.load());
  }

  private load(): string[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
    } catch {
      return [];
    }
  }

  get key(): string {
    return this.storageKey;
  }

  has(fileKey: string): boolean {
    return this.keys.has(fileKey);
  }

  get size(): number {
    return this.keys.size;
  }

  /** Adiciona e persiste. Devolve false se o navegador não deixou salvar. */
  add(fileKey: string): boolean {
    this.keys.add(fileKey);
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(Array.from(this.keys)));
      return true;
    } catch {
      return false;
    }
  }
}
