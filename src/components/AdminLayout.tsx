import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from './Logo';

const AdminLayout = () => {
  const location = useLocation();

  const links = [
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
      </header>
      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
