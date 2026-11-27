import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet } from "./ui";
import { saveLocationConsent } from "../training/locationDisclosure";

export default function LocationDisclosure() {
  const [answer, setAnswer] = useState<((accepted: boolean) => void) | null>(null);
  useEffect(() => {
    const listener = (event: Event) => setAnswer(() => (event as CustomEvent<(accepted: boolean) => void>).detail);
    window.addEventListener("buky-location-disclosure", listener);
    return () => window.removeEventListener("buky-location-disclosure", listener);
  }, []);
  const finish = (accepted: boolean) => { if (accepted) saveLocationConsent(); answer?.(accepted); setAnswer(null); };
  return <Sheet open={!!answer} onClose={() => finish(false)} label="Usamos sua localização durante o treino">
    <h2 className="text-2xl font-bold">Usamos sua localização durante o treino</h2>
    <p className="mt-4">Coletamos sua localização precisa, inclusive com o app em segundo plano ou a tela apagada, para contar seus pontos do percurso e Bukys. Isso acontece somente durante um treino ativo e não ? usado para publicidade.</p>
    <Link className="mt-3 block underline" to="/privacidade" onClick={() => finish(false)}>Política de privacidade</Link>
    <button className="buky-btn mt-5" type="button" onClick={() => finish(true)}>Aceitar e continuar</button>
    <button className="mt-3 w-full py-3" type="button" onClick={() => finish(false)}>Agora não</button>
  </Sheet>;
}
