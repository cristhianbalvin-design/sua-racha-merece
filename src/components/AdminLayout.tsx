import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from './Logo';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const links = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/usuarios', label: 'Usuários' },
    { to: '/admin/campanhas', label: 'Campanhas' },
    { to: '/admin/participacoes', label: 'Participações' },
    { to: '/admin/qualificacao', label: 'Qualificação' },
    { to: '/admin/ganhadores', label: 'Ganhadores' },
    { to: '/admin/esportes', label: 'Esportes' },
    { to: '/admin/regioes', label: 'Regiões' },
  ];

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-admin-header px-4 md:px-8 py-4 flex items-center justify-between"
        style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
        <div className="flex items-center gap-4">
          <Link to="/admin/usuarios">
            <Logo size="sm" />
          </Link>
          <span className="text-ui bg-primary/20 text-primary-foreground px-3 py-1 rounded-md text-xs">
            ADMIN
          </span>
        </div>
        <nav className="flex items-center gap-3 md:gap-6 overflow-x-auto">
          {links.map(({ to, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`text-ui text-xs md:text-sm transition-colors whitespace-nowrap ${
                  active ? 'text-foreground' : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 hidden md:flex">
          <Link to="/admin/perfil" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-sm font-bold text-foreground">{user?.name || (isAdmin ? 'Administrador' : 'Admin')}</span>
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
          <button
            onClick={handleLogout}
            title="Sair"
            className="ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
