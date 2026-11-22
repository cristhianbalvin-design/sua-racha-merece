import { useAuth } from '@/contexts/AuthContext';
import { ProfileMenu } from './ProfileMenu';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export function Header() {
  const { user } = useAuth();
  return (
    <header className="l-header l-wrap">
      <Link to="/" aria-label="3buk, início">
        <Logo variant="dark" />
      </Link>
      {user ? <ProfileMenu /> : <Link className="l-button" to="/cadastro">CADASTRE-SE</Link>}
    </header>
  );
}
