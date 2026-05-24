import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import MobileNav from './MobileNav';
import DesktopHeader from './DesktopHeader';
import { apiGetActiveHomePopup, apiAcceptTermsForOAuthUser } from '@/lib/mockApi';
import type { HomePopup } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { TermsModal } from './TermsModal';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserLayout = () => {
  const [activePopup, setActivePopup] = useState<HomePopup | null>(null);
  const { user, updateUserContext } = useAuth();
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    apiGetActiveHomePopup().then((popup) => {
      if (!popup) return;
      if (sessionStorage.getItem(`participant-popup-dismissed-${popup.id}`)) return;
      setActivePopup(popup);
    });
  }, []);

  useEffect(() => {
    if (user && user.acceptedTerms === false) {
      setShowTermsModal(true);
    } else {
      setShowTermsModal(false);
    }
  }, [user]);

  const closePopup = () => {
    if (activePopup) {
      sessionStorage.setItem(`participant-popup-dismissed-${activePopup.id}`, 'true');
    }
    setActivePopup(null);
  };

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
    <div className="min-h-svh bg-background">
      {activePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 backdrop-blur-sm px-3 md:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="relative w-full max-w-[min(96vw,1400px)]"
          >
            <button
              onClick={closePopup}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/95 text-foreground border border-border card-shadow hover:bg-muted transition-colors"
              aria-label="Fechar popup"
            >
              <X size={18} />
            </button>
            <a href={activePopup.targetUrl} target="_blank" rel="noreferrer" onClick={closePopup}>
              <img
                src={activePopup.imageUrl}
                alt={activePopup.name}
                className="w-full aspect-[4/3] max-h-[78vh] object-cover rounded-2xl border border-border card-shadow bg-card"
              />
            </a>
          </motion.div>
        </div>
      )}
      <DesktopHeader />
      <main className="pb-20 md:pb-8">
        <Outlet />
      </main>
      <MobileNav />

      {/* Enforce Terms Modal overlay if user is logged in but hasn't accepted terms */}
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
