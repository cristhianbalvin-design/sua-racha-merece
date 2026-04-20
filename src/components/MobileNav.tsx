import { Link, useLocation } from 'react-router-dom';
import { Home, Trophy, User, Bell } from 'lucide-react';
import { notifications } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const unreadCount = user ? notifications.filter((n) => n.userId === user.id && !n.read).length : 0;

  const links = [
    { to: '/dashboard', icon: Home, label: 'Campañas' },
    { to: '/participacoes', icon: Trophy, label: 'Participaciones' },
    { to: '/notificacoes', icon: Bell, label: 'Avisos', badge: unreadCount },
    { to: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg bg-background/80 md:hidden"
      style={{ boxShadow: '0 -1px 0 hsl(var(--border))' }}>
      <div className="flex items-center justify-around py-2 px-4">
        {links.map(({ to, icon: Icon, label, badge }) => {
          const active = location.pathname === to || (to === '/dashboard' && location.pathname.startsWith('/campanha'));
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors relative ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className="relative flex items-center justify-center h-6">
                <Icon size={20} />
                {badge !== undefined && badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
              </div>
              <span className="text-xs font-bold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
