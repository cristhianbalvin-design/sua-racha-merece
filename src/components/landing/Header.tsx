import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export function Header() {
  return (
    <header className="l-header l-wrap">
      <Link to="/" aria-label="3buk, início">
        <Logo variant="dark" />
      </Link>
      <Link className="l-button" to="/registro">
        CADASTRE-SE
      </Link>
    </header>
  );
}
