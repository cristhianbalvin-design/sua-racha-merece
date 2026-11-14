import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function usePaymentsConfig() {
  return useQuery({
    queryKey: ['payments-config'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('app_payments_config');
      if (error) throw error;
      return data as { mode: string; contact_email: string };
    },
  });
}

/** Tarjeta de pago manual (fase de pruebas): el atleta coordina el pago por e-mail con 3buk. */
export function ManualPaymentCard({ purpose, variant = "buky" }: { purpose: "premium" | "topup" | "shop"; variant?: "buky" | "web" }) {
  const { user } = useAuth();
  const config = usePaymentsConfig();
  const email = config.data?.contact_email || "contato@3buk.com";
  const subject = purpose === "premium" ? "Quero assinar o Premium" : purpose === "topup" ? "Quero recarregar saldo" : "Quero pagar um pedido da loja";
  const body = `${subject}.\nE-mail da conta: ${user?.email ?? ""}\n${purpose === "topup" ? "Valor da recarga: " : ""}`;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const text =
    purpose === "shop"
      ? "Nesta fase de testes, os pagamentos da loja são combinados com a equipe 3buk. Escreva informando o e-mail da sua conta e os detalhes do pedido."
      : purpose === "premium"
        ? "Nesta fase de testes, a assinatura Premium é feita diretamente com a equipe 3buk. Escreva informando o e-mail da sua conta e nós ativamos o seu Premium."
        : "Nesta fase de testes, as recargas de saldo são feitas diretamente com a equipe 3buk. Escreva informando o e-mail da sua conta e o valor que deseja recarregar.";
  const copy = () =>
    void navigator.clipboard
      .writeText(email)
      .then(() => toast.success("E-mail copiado."))
      .catch(() => toast.error("Não foi possível copiar o e-mail."));
  const buky = variant === "buky";
  return (
    <div className={buky ? "mt-3 rounded-2xl border border-[var(--buky-line)] bg-[#0d0d0d] p-4" : "rounded-2xl border border-border bg-card p-5 card-shadow"}>
      <p className={buky ? "flex items-center gap-2 font-semibold" : "flex items-center gap-2 font-semibold text-foreground"}>
        <Mail size={18} className={buky ? "text-[var(--buky-neon)]" : "text-primary"} /> Pagamentos pelo e-mail
      </p>
      <p className={buky ? "mt-2 text-[13px] text-[var(--buky-muted)]" : "mt-2 text-sm text-muted-foreground"}>{text}</p>
      <a href={href} className={buky ? "buky-btn mt-3 block text-center" : "mt-3 block rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground"}>
        Escrever e-mail
      </a>
      <p className={buky ? "mt-2 text-center text-[13px] text-[var(--buky-muted)]" : "mt-2 text-center text-sm text-muted-foreground"}>{email}</p>
      <button type="button" onClick={copy} className={buky ? "mt-2 min-h-11 w-full rounded-full border border-[var(--buky-line)] text-sm" : "mt-2 w-full rounded-full border border-border px-5 py-2.5 text-sm"}>
        Copiar e-mail
      </button>
    </div>
  );
}
