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
  const nativePermission = () =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'default';

  const [pushEnabled, setPushEnabled] = useState(nativePermission() === 'granted');

  const handleLogout = async () => {
    await OneSignal.logout();
    await logout();
    navigate('/');
  };

  useEffect(() => {
    const setupOneSignal = async () => {
      try {
        if (user?.email && typeof OneSignal !== 'undefined' && OneSignal.User) {
          await OneSignal.login(user.email);
          OneSignal.User.addTag("role", "admin");
        }
      } catch (err) {
        console.error("OneSignal admin setup error:", err);
      }
    };
    setupOneSignal();
  }, [user]);

  const handleEnablePush = async () => {
    const current = nativePermission();

    if (current === 'granted') {
      toast.info("Push ya activo", {
        description: "Las notificaciones ya están habilitadas en este dispositivo.",
      });
      setPushEnabled(true);
      return;
    }

    if (current === 'denied') {
      toast.error("Permiso bloqueado", {
        description: "Habilitá las notificaciones desde la configuración del navegador.",
      });
      return;
    }

    if (typeof OneSignal !== 'undefined' && OneSignal.Notifications) {
      OneSignal.Notifications.requestPermission();
      // Escuchar la respuesta del diálogo del navegador
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
        OneSignal.Notifications.removeEventListener('permissionChange', onPermissionChange);
      };
      OneSignal.Notifications.addEventListener('permissionChange', onPermissionChange);
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
      <header className="bg-admin-header flex flex-col"
        style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
        
        {/* Top Section */}
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/admin/usuarios" className="flex-shrink-0">
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
          
          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <Link to="/admin/perfil" className="hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity">
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
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="border-t border-border/10">
          <nav className="flex items-center px-2 md:px-6 overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {links.map(({ to, label }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`text-[11px] md:text-sm font-bold transition-colors whitespace-nowrap px-3 py-3 border-b-2 ${
                    active ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {label.toUpperCase()}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
