import { useState } from "react";
import { isValidCpf, maskCpf, saveCpf } from "@/lib/cpf";

export default function CpfDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!isValidCpf(value)) { setError("Informe um CPF válido."); return; }
    setBusy(true);
    try { await saveCpf(value); onSaved(); }
    catch { setError("Não foi possível salvar o CPF. Tente novamente."); }
    finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="cpf-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
    <div className="w-full max-w-md rounded-2xl bg-[#171717] p-6 text-white shadow-xl">
      <h2 id="cpf-title" className="text-xl font-bold">Informe seu CPF</h2>
      <p className="mt-3 text-sm">Pedimos seu CPF para registrar quem baixa cada foto, por segurança e para emissão de comprovantes. Ele fica guardado com acesso restrito e não aparece para outras pessoas.</p>
      <label className="mt-4 block">CPF<input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(maskCpf(e.target.value))} placeholder="000.000.000-00" className="mt-1 block w-full rounded border border-gray-500 bg-black p-3" /></label>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-3"><button type="button" onClick={() => void submit()} disabled={busy} className="rounded bg-lime-400 px-4 py-2 font-bold text-black">Salvar</button><button type="button" onClick={onClose} disabled={busy}>Cancelar</button></div>
    </div>
  </div>;
}
