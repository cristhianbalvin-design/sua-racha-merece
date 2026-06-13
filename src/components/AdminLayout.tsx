import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from './Logo';
import OneSignal from 'react-onesignal';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleLogout = async () => {
    await OneSignal.logout();
    await logout();
    navigate('/');
  };

  useEffect(() => {
    if (typeof OneSignal === 'undefined' || !OneSignal.Notifications) return;

    const onPermissionChange = (granted: boolean) => {
      setPushEnabled(granted);
      if (granted) {
        OneSignal.User?.addTag("role", "admin");
        toast.success("Push activado", {
          description: "Recibirás notificaciones de nuevos registros de atletas.",
        });
      } else {
        toast.error("Permiso denegado", {
          description: "Habilitá las notificaciones en la configuración del navegador.",
        });
      }
    };

    OneSignal.Notifications.addEventListener('permissionChange', onPermissionChange);
    return () => {
      OneSignal.Notifications.removeEventListener('permissionChange', onPermissionChange);
    };
  }, []);

  useEffect(() => {
    const setupOneSignal = async () => {
      try {
        if (user?.email && typeof OneSignal !== 'undefined' && OneSignal.User) {
          await OneSignal.login(user.email);
          OneSignal.User.addTag("role", "admin");
          setPushEnabled(!!OneSignal.Notifications?.permission);
        }
      } catch (err) {
        console.error("OneSignal admin setup error:", err);
      }
    };
    setupOneSignal();
  }, [user]);

  const handleEnablePush = () => {
    if (typeof OneSignal !== 'undefined' && OneSignal.Notifications) {
      OneSignal.Notifications.requestPermission();
    }
  };

  const links = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/usuarios', label: 'Usuários' },
    { to: '/admin/campanhas', label: 'Campanhas' },
    { to: '/admin/participacoes', label: 'Participações' },
    { to: '/admin/qualificacao', label: 'Qualificação' },
    { to: '/admin/ganhadores', label: 'Ganhadores' },
    { to: '/admin/popups', label: 'Popups' },
    { to: '/admin/esportes', label: 'Esportes' },
    { to: '/admin/regioes', label: 'Regiões' },
    { to: '/admin/termos', label: 'Termos' },
  ];

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-admin-header px-4 md:px-8 py-4 flex items-center justify-between"
        style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/admin/usuarios">
            <Logo size="sm" />
          </Link>
          <button
            onClick={handleEnablePush}
            disabled={pushEnabled}
            className={`text-[10px] md:text-xs px-2 py-1.5 rounded-md font-bold whitespace-nowrap shadow-md transition-transform border border-white/20 ${
              pushEnabled
                ? 'bg-green-600 text-white cursor-default opacity-80'
                : 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
            }`}
          >
            {pushEnabled ? '✅ Push Activo' : '🔔 Activar Push'}
          </button>
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
