import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { currentUser } from '@/data/mockData';

const DesktopHeader = () => {
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Campanhas' },
    { to: '/ganhadores', label: 'Ganhadores' },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-4 bg-card"
      style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
      <Link to="/dashboard">
        <Logo size="sm" />
      </Link>
      <nav className="flex items-center gap-8">
        {links.map(({ to, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`text-ui transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <Link to="/perfil" className="flex items-center gap-3">
        <span className="text-sm font-bold text-foreground">{currentUser.name}</span>
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-8 h-8 rounded-full object-cover img-outline"
        />
      </Link>
    </header>
  );
};

export default DesktopHeader;
