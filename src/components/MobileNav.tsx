import { Link, useLocation } from 'react-router-dom';
import { Home, Trophy, User } from 'lucide-react';

const MobileNav = () => {
  const location = useLocation();

  const links = [
    { to: '/dashboard', icon: Home, label: 'Início' },
    { to: '/campanhas', icon: Trophy, label: 'Campanhas' },
    { to: '/perfil', icon: User, label: 'Meu Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg bg-background/80 md:hidden"
      style={{ boxShadow: '0 -1px 0 hsl(var(--border))' }}>
      <div className="flex items-center justify-around py-2 px-4">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to === '/campanhas' && location.pathname.startsWith('/campanha'));
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-bold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
