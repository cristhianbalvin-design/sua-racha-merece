import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from '@/components/Logo';
import { usePhotographer } from '@/hooks/usePhotographer';

const links = [
  { to: '/fotografo', label: 'Painel', end: true },
  { to: '/fotografo/enviar', label: 'Enviar fotos', end: false },
  { to: '/fotografo/fotos', label: 'Minhas fotos', end: false },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'F';

const PhotographerLayout = () => {
  const { profile, signOut } = usePhotographer();
  const navigate = useNavigate();
  const name = profile?.name || 'Fotógrafo';

  const handleSignOut = async () => {
    await signOut();
    navigate('/fotografo/login', { replace: true });
  };

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md" style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
        <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/fotografo" className="flex-shrink-0" aria-label="Painel">
              <Logo size="sm" />
            </Link>
            <span className="hidden sm:inline text-ui text-[11px] text-muted-foreground">PORTAL DO FOTÓGRAFO</span>
          </div>
          <div className="flex items-center gap-3">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={name} className="w-8 h-8 rounded-full object-cover bg-muted" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center">
                {initials(name)}
              </span>
            )}
            <span className="hidden md:inline text-sm font-bold text-foreground max-w-[200px] truncate">{name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
        <nav className="flex items-center px-2 md:px-6 overflow-x-auto" aria-label="Portal do fotógrafo">
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `text-[11px] md:text-sm font-bold whitespace-nowrap px-3 py-3 border-b-2 transition-colors ${
                  isActive ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                }`
              }
            >
              {label.toUpperCase()}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default PhotographerLayout;
