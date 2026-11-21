import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { SOCIAL_LINKS } from '@/content/landing';

export function Footer() {
  return (
    <footer className="l-wrap l-footer">
      <div className="l-footer-inner">
        <div className="l-brand">
          <Link to="/">
            <Logo variant="dark" />
          </Link>
          <span>
            ENTRETENIMENTO ESPORTIVO
            <br />
            PARA AMADORES.
          </span>
        </div>
        <nav aria-label="Rodapé">
          <div>
            <strong>ECOSSISTEMA</strong>
            <Link to="/sobre">Sobre a 3buk</Link>
            <Link to="/sobre#como-funciona">Como funciona</Link>
          </div>
          <div>
            <strong>CAMPANHAS</strong>
            <Link to="/campanhas">Campanhas atuais</Link>
            <Link to="/regulamento">Regulamento</Link>
          </div>
          <div>
            <strong>CONTATO</strong>
            <Link to="/contato">Fale conosco</Link>
            <Link to="/contato#imprensa">Imprensa</Link>
          </div>
        </nav>
        <div className="l-social">
          {SOCIAL_LINKS.filter((s) => s.href).map(({ label, href, icon: Icon }) => (
            <a key={label} href={href} aria-label={label}>
              <Icon />
            </a>
          ))}
        </div>
      </div>
      <div className="l-footer-line" />
    </footer>
  );
}
