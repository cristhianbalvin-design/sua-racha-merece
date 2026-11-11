import { useEffect, useState } from "react";
import CpfDialog from "@/components/CpfDialog";
import { getMaskedCpf } from "@/lib/cpf";

export default function CpfProfile() {
  const [cpf, setCpf] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = () => { void getMaskedCpf().then(setCpf).catch(() => {}); };
  useEffect(refresh, []);
  return <div className="my-4 text-sm"><span>CPF: {cpf ?? "Não informado"}</span>{" "}
    <button type="button" className="underline" onClick={() => setOpen(true)}>{cpf ? "Alterar" : "Informar"}</button>
    {open && <CpfDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
  </div>;
}
