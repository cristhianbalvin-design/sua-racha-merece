import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = '3buk_pwa_dismissed_at';
// Re-show after 1 day if dismissed
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const usePWAInstall = () => {
  const { isAdmin } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Cooldown: dismissed less than 1 day ago
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShowPrompt(false));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (isAdmin && !showPrompt) {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true;
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      const isDismissed = dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS;
      
      if (!isStandalone && !isDismissed && (deferredPrompt || isIOS)) {
        setTimeout(() => setShowPrompt(true), 1500);
      }
    }
  }, [isAdmin, deferredPrompt, isIOS, showPrompt]);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  return { showPrompt, isIOS, canInstall: !!deferredPrompt || isIOS, install, dismiss };
};
