import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TESTIMONIALS } from '@/content/landing';

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  if (!TESTIMONIALS.length) return null;
  return (
    <section className="l-wrap l-section">
      <div className="l-section-head">
        <h2>QUEM VIVE, CONTA.</h2>
        <div>
          <button
            className="l-arrow"
            aria-label="Depoimento anterior"
            onClick={() => ref.current?.scrollBy({ left: -400, behavior: 'smooth' })}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="l-arrow"
            aria-label="Próximo depoimento"
            onClick={() => ref.current?.scrollBy({ left: 400, behavior: 'smooth' })}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="l-carousel" ref={ref}>
        {TESTIMONIALS.map((t) => (
          <article className="l-testimonial" key={t.name}>
            <img src={t.img} alt={t.name} width="900" height="600" loading="lazy" />
            <div>
              <blockquote>“{t.quote}”</blockquote>
              <strong>{t.name}</strong>
              <p>{t.meta}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
