import { ScanFace } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function FaceBanner() {
  const { user } = useAuth();
  return (
    <section className="l-wrap">
      <div className="l-face">
        <ScanFace size={58} aria-hidden="true" />
        <h2>
          RECONHECIMENTO
          <br />
          <span>FACIAL</span>
        </h2>
        <img
          src="/landing/bg-reconhecimento-facial.webp"
          alt=""
          aria-hidden="true"
          width="900"
          height="600"
          loading="lazy"
        />
        <div className="l-face-actions">
          <Link className="l-button" to={user ? '/app/fotos' : '/?redirect=%2Fapp%2Ffotos#acesso'}>
            BUSCAR FOTOS →
          </Link>
          <button
            type="button"
            onClick={() => {
              document.getElementById('landing-email')?.focus();
              document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            OU ENTRAR NA SUA CONTA
          </button>
        </div>
      </div>
    </section>
  );
}
