import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiGetMyWallet } from '@/lib/walletApi';
import { usePaymentsConfig } from '@/features/buky/components/PaymentsConfig';

export function Plans() {
  const { user } = useAuth();
  const config = usePaymentsConfig();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet, enabled: Boolean(user) });
  const premiumTarget = wallet.data?.premium?.active ? "/app/patrocinio" : "/app/perfil/saldo";
  const email = config.data?.contact_email || 'contato@3buk.com';
  return (
    <section className="l-wrap l-plans" aria-label="Planos">
      <div
        className="l-plan"
        style={{
          backgroundImage:
            'linear-gradient(90deg,#0b0b0b 22%,transparent),url(/landing/bg-freemium-corredor.webp)',
        }}
      >
        <h2>FREEMIUM</h2>
        <p>
          SUA FOTO.
          <br />
          SUA HISTÓRIA.
        </p>
        <Link className="l-button l-outline" to={user ? '/app/patrocinio' : '/?redirect=%2Fapp%2Fpatrocinio#acesso'}>
          ENVIAR FOTO →
        </Link>
      </div>
      <div>
        <div
          className="l-plan"
          style={{
            backgroundImage:
              'linear-gradient(90deg,#0b0b0b 22%,transparent),url(/landing/bg-premium-nadador.webp)',
          }}
        >
          <h2 className="l-green">PREMIUM</h2>
          <p>
            PARTICIPE.
            <br />
            VIVA MAIS.
          </p>
          <Link className="l-button" to={user ? premiumTarget : "/?redirect=%2Fapp%2Fperfil%2Fsaldo#acesso"}>
            PARTICIPAR →
          </Link>
        </div>
        {(config.data?.mode === 'manual' || config.isLoading || config.isError) && (
          <p className="l-payment">
            Assinatura Premium: o pagamento é feito pelo e-mail <a href={`mailto:${email}`}>{email}</a>
          </p>
        )}
      </div>
    </section>
  );
}
