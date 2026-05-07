import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const PWAInstallPrompt = () => {
  const { showPrompt, isIOS, canInstall, install, dismiss } = usePWAInstall();

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-3xl p-6 pb-10 card-shadow max-w-lg mx-auto"
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>

            {/* App icon + name */}
            <div className="flex items-center gap-4 mb-5">
              <img
                src="/pwa-192.svg"
                alt="3BUK"
                className="w-16 h-16 rounded-2xl"
              />
              <div>
                <h2 className="font-bold italic text-2xl text-foreground uppercase">3BUK</h2>
                <p className="text-xs text-muted-foreground">Sua racha é seu mérito</p>
              </div>
            </div>

            <h3 className="font-bold text-lg text-foreground mb-1">
              ¡Instala la app!
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Accede más rápido, recibe notificaciones y úsala sin conexión como una app nativa.
            </p>

            {isIOS ? (
              /* iOS: manual instructions */
              <div className="bg-muted rounded-2xl p-4 mb-4 space-y-2 text-sm text-foreground">
                <p className="font-bold text-xs text-muted-foreground uppercase mb-3">Cómo instalar en iOS</p>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary rounded-xl p-2 flex-shrink-0">
                    <Share size={18} />
                  </span>
                  <p>Toca el botón <strong>Compartir</strong> en Safari</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary rounded-xl p-2 flex-shrink-0 text-lg font-bold">+</span>
                  <p>Selecciona <strong>"Agregar a inicio"</strong></p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary rounded-xl p-2 flex-shrink-0 font-bold text-sm">OK</span>
                  <p>Confirma tocando <strong>"Agregar"</strong></p>
                </div>
              </div>
            ) : (
              /* Android / Desktop */
              <motion.button
                onClick={install}
                disabled={!canInstall}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl btn-shadow flex items-center justify-center gap-2 text-sm mb-3"
              >
                <Download size={18} />
                INSTALAR AHORA
              </motion.button>
            )}

            <button
              onClick={dismiss}
              className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors"
            >
              Ahora no
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
