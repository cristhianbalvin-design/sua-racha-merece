/**
 * Coleta arquivos de um evento de soltar (drag & drop), inclusive pastas inteiras
 * (via webkitGetAsEntry, suportado por Chrome, Edge, Firefox e Safari).
 */

export interface CollectedFile {
  file: File;
  /** Caminho relativo dentro da pasta solta/escolhida (ou o nome do arquivo). */
  relativePath: string;
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}
interface FsFileEntry extends FsEntry {
  file: (ok: (f: File) => void, fail: (e: unknown) => void) => void;
}
interface FsDirEntry extends FsEntry {
  createReader: () => { readEntries: (ok: (entries: FsEntry[]) => void, fail: (e: unknown) => void) => void };
}

const readAllEntries = async (dir: FsDirEntry): Promise<FsEntry[]> => {
  const reader = dir.createReader();
  const out: FsEntry[] = [];
  // readEntries devolve no máximo ~100 itens por chamada: repetir até vir vazio.
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    out.push(...batch);
  }
  return out;
};

const walk = async (entry: FsEntry, out: CollectedFile[]): Promise<void> => {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FsFileEntry).file(resolve, reject));
    out.push({ file, relativePath: entry.fullPath.replace(/^\//, '') || file.name });
  } else if (entry.isDirectory) {
    for (const child of await readAllEntries(entry as FsDirEntry)) await walk(child, out);
  }
};

/** Devolve true se algum item solto é uma pasta. */
export const collectDroppedFiles = async (dt: DataTransfer): Promise<{ files: CollectedFile[]; hadFolder: boolean }> => {
  const items = Array.from(dt.items || []);
  const entries = items
    .filter((i) => i.kind === 'file')
    .map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);

  if (entries.length && entries.every(Boolean)) {
    const out: CollectedFile[] = [];
    let hadFolder = false;
    for (const e of entries as FsEntry[]) {
      if (e.isDirectory) hadFolder = true;
      await walk(e, out);
    }
    return { files: out, hadFolder };
  }
  return { files: Array.from(dt.files || []).map((file) => ({ file, relativePath: file.name })), hadFolder: false };
};

/** Arquivos de um <input type="file" webkitdirectory>, com o caminho relativo. */
export const collectInputFiles = (list: FileList | null): CollectedFile[] =>
  Array.from(list || []).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
