import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Winner } from '@/data/mockData';

export function Winners({ winners }: { winners: Winner[] }) {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!winners.length) return null;
  const move = (direction: number) => {
    const next = Math.max(0, Math.min(winners.length - 1, index + direction));
    ref.current?.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    setIndex(next);
  };
  return (
    <section className="l-wrap l-section">
      <div className="l-section-head">
        <h2>GANHADORES DAS ÚLTIMAS CAMPANHAS. <Link to={user ? "/app/sorteios" : "/?redirect=%2Fapp%2Fsorteios#acesso"}>Ver todos →</Link></h2>
        <div>
          <button className="l-arrow" aria-label="Ganhador anterior" onClick={() => move(-1)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>
            {String(index + 1).padStart(2, '0')} / {String(winners.length).padStart(2, '0')}
          </span>
          <button className="l-arrow" aria-label="Próximo ganhador" onClick={() => move(1)}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="l-carousel"
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const children = Array.from(el.children) as HTMLElement[];
          const nearest = children.reduce(
            (best, child, i) =>
              Math.abs(child.offsetLeft - el.scrollLeft - el.offsetLeft) <
              Math.abs(children[best].offsetLeft - el.scrollLeft - el.offsetLeft)
                ? i
                : best,
            0,
          );
          setIndex(nearest);
        }}
      >
        {winners.map((w) => (
          <article className="l-winner" key={w.id}>
            {w.photo ? (
              <img src={w.photo} alt={w.user.name} width="640" height="427" loading="lazy" />
            ) : (
              <div className="l-initials">
                {w.user.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </div>
            )}
            <div>
              <strong>{w.user.name}</strong>
              <p>
                {w.user.sport} {w.user.city && `· ${w.user.city}`}
              </p>
              {w.campaignMonth && w.campaignMonth !== 'N/A' && <p>{w.campaignMonth}</p>}
              {w.prize && <p>{w.prize}</p>}
              {w.justification && !w.justification.startsWith('Nota Total:') && <p>{w.justification}</p>}
              <small>Ganhador</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
