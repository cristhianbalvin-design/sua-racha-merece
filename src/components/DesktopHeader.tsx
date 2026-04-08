import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetNotifications } from '@/lib/mockApi';

const DesktopHeader = () => {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiGetNotifications(user.id).then((notifs) => {
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
  }, [user, location.pathname]); // Refresh on navigation

  const links = [
    { to: '/dashboard', label: 'Campanhas' },
    { to: '/participacoes', label: 'Participações' },
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
        <Link
          to="/notificacoes"
          className={`relative transition-colors ${
            location.pathname === '/notificacoes' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </nav>
      <Link to="/perfil" className="flex items-center gap-3">
        <span className="text-sm font-bold text-foreground">{user?.name || (isAdmin ? 'Administrador' : 'Atleta')}</span>
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover img-outline bg-muted"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center img-outline">
            <UserIcon size={16} className="text-muted-foreground" />
          </div>
        )}
      </Link>
    </header>
  );
};

export default DesktopHeader;
