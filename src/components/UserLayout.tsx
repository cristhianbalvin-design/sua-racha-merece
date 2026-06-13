import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, X, Images } from 'lucide-react';
import DesktopHeader from './DesktopHeader';
import MobileNav from './MobileNav';
import UserProfileBanner from './UserProfileBanner';
import Logo from './Logo';
import { apiGetActiveHomePopup, apiAcceptTermsForOAuthUser, apiGetNotifications } from '@/lib/mockApi';
import type { HomePopup } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { TermsModal } from './TermsModal';
import { toast } from 'sonner';

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

const FOTOS_HREF = 'https://drive.google.com/drive/folders/1fgjMr5gKO2aDpTvbeYVio_HtbF-IX4tI';

const mainTabs = [
  { to: '/dashboard', label: 'CAMPANHAS' },
  { to: '/participacoes', label: 'PARTICIPAÇÕES' },
  { to: null, href: FOTOS_HREF, label: 'FOTOGRAFIAS 3BUK', icon: Images, featured: true },
  { to: '/ganhadores', label: 'GANHADORES' },
];

const UserLayout = () => {
  const location = useLocation();
  const { user, updateUserContext } = useAuth();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Show profile banner on all pages except campaign detail/submission
  const showBanner = !location.pathname.startsWith('/campanha');
  const isCampaignRoute = location.pathname.startsWith('/campanha');
  const portalBackgroundClass = isCampaignRoute
    ? 'bg-black'
    : "bg-black bg-[linear-gradient(rgba(0,0,0,0.58),rgba(0,0,0,0.7)),url('/user-portal-bg-mobile.jpeg')] bg-cover bg-top bg-no-repeat md:bg-[linear-gradient(rgba(0,0,0,0.58),rgba(0,0,0,0.7)),url('/user-portal-bg.jpeg')]";

  const isHome = location.pathname === '/dashboard' || location.pathname === '/campanhas';

  useEffect(() => {
    if (!user) return;
    apiGetNotifications(user.id).then((notifs) => {
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
  }, [user, location.pathname]);



  useEffect(() => {
    if (user && user.acceptedTerms === false) {
      setShowTermsModal(true);
    } else {
      setShowTermsModal(false);
    }
  }, [user]);

  const handleAcceptTerms = async () => {
    if (!user) return;
    try {
      const success = await apiAcceptTermsForOAuthUser(user.id);
      if (success) {
        updateUserContext({ acceptedTerms: true });
        setShowTermsModal(false);
        toast.success('Termos e Condições aceitos com sucesso!');
      }
    } catch (e: any) {
      console.error('Accept terms error:', e);
      toast.error('Erro ao aceitar termos. Tente novamente.');
    }
  };

  return (
    <div className="min-h-svh bg-black">
      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background/90 backdrop-blur-md"
        style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}
      >
        <Logo size="sm" />
        <Link to="/notificacoes" className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── Mobile horizontal tab nav ── */}
      {showBanner && (
        <div
          className="md:hidden sticky top-[49px] z-30 bg-background/90 backdrop-blur-md overflow-x-auto scrollbar-hide"
          style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}
        >
          <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex items-center px-2 min-w-max">
            {mainTabs.map(({ to, href, label, icon: Icon, featured }) => {
              const isActive = to !== null && (location.pathname === to || (to === '/dashboard' && location.pathname === '/campanhas'));
              if (featured) {
                return (
                  <a
                    key={label}
                    href={href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mx-1.5 my-1.5 px-3 py-1.5 text-[10px] font-bold whitespace-nowrap rounded-full border transition-colors bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 hover:shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                  >
                    {Icon && <Icon size={12} />}
                    {label}
                  </a>
                );
              }
              return (
                <Link
                  key={to!}
                  to={to!}
                  className={`flex items-center gap-1.5 px-3 py-3 text-[10px] font-bold whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Desktop header ── */}
      <DesktopHeader />

      {/* ── Profile banner (all main pages) ── */}
      <div
        className={`min-h-[calc(100svh-49px)] md:min-h-[calc(100svh-65px)] ${portalBackgroundClass}`}
      >

      {showBanner && <UserProfileBanner />}

      <main className="pb-24 md:pb-8">
        <Outlet />
      </main>

      <MobileNav />
      </div>

      {user && user.acceptedTerms === false && (
        <TermsModal
          isOpen={showTermsModal}
          onClose={() => {
            if (user.acceptedTerms === false) {
              toast.warning('Você precisa aceitar os Termos e Condições para acessar a plataforma.');
            } else {
              setShowTermsModal(false);
            }
          }}
          onAccept={handleAcceptTerms}
        />
      )}
    </div>
  );
};

export default UserLayout;
