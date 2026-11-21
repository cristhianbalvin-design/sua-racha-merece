import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';
import { PAGINAS } from '@/content/landing';
import '@/components/landing/landing.css';

export default function Institucional({ page }: { page: keyof typeof PAGINAS }) {
  const data = PAGINAS[page];
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, page]);
  return (
    <div className="landing-3buk l-institutional">
      <header className="l-wrap l-header">
        <Link to="/">
          <Logo variant="dark" />
        </Link>
      </header>
      <main className="l-wrap l-institutional-main">
        <h1>{data.title}</h1>
        <p>{data.intro}</p>
        {page === 'contato' && (
          <a className="l-button" href="mailto:contato@3buk.com">
            ESCREVER E-MAIL
          </a>
        )}
        {data.sections.map((section) => (
          <section id={'id' in section ? section.id : undefined} key={section.title}>
            <h2>{section.title}</h2>
            {page === 'regulamento' ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              section.items.map((item) => <p key={item}>{item}</p>)
            )}
          </section>
        ))}
        {page === 'regulamento' && <small>Versão preliminar — sujeita a atualização.</small>}
      </main>
      <footer className="l-wrap l-institutional-footer">
        <Link to="/">Voltar ao início</Link>
      </footer>
    </div>
  );
}
