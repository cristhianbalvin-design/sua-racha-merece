import { useState } from 'react';
import { FAQS } from '@/content/landing';

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="l-wrap l-faq">
      <div className="l-faq-inner">
        <div>
          <h2>
            PERGUNTAS
            <br />
            FREQUENTES
          </h2>
          <i />
        </div>
        <div className="l-faq-list">
          {FAQS.map(([question, answer], i) => (
            <div key={question}>
              <button
                type="button"
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                id={`faq-button-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {question}
                <span aria-hidden="true">{open === i ? '−' : '+'}</span>
              </button>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                hidden={open !== i}
              >
                <p>{answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
