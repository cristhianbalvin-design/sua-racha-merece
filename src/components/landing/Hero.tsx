import { useAuth } from '@/contexts/AuthContext';
import { WelcomeCard } from './ProfileMenu';
import { LoginCard } from './LoginCard';

export function Hero() {
  const { user } = useAuth();
  return (
    <section className="l-wrap l-hero">
      <div className="l-hero-inner">
        <div className="l-ghost" aria-hidden="true">
          CORRE
        </div>
        <div className="l-hero-title">
          <h1>
            PEGUE
            <br />
            BUKYS,
            <br />
            <span>
              GANHE
              <br />
              CORRENDO.
            </span>
          </h1>
          <i />
        </div>
        <picture className="l-mascot">
          <source srcSet="/landing/mascota-hero.webp" type="image/webp" />
          <img
            src="/landing/mascota-hero.png"
            alt="Mascote 3buk fazendo sinal de paz"
            width="1024"
            height="1536"
            fetchPriority="high"
          />
        </picture>
        {user ? <WelcomeCard /> : <LoginCard />}
      </div>
    </section>
  );
}
