import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Instagram, Globe, Youtube, Share2, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { SportProfile } from '@/types/sportProfile';
import { apiGetSportProfile, apiUpsertSportProfile } from '@/lib/mockApi';

interface SocialLinksFormProps {
  userId: string;
  onSaved?: (profile: SportProfile) => void;
}

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

// Simple TikTok icon SVG since lucide doesn't have an official tiktok icon
const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743 2.895 2.895 0 0 1 2.313-4.639c.329 0 .647.054.945.152V9.38a6.333 6.333 0 0 0-.945-.072 6.34 6.34 0 0 0-6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 0 0 0 6.328-6.34V8.718a8.21 8.21 0 0 0 4.775 1.516V6.789a4.814 4.814 0 0 1-1-.103z" />
  </svg>
);

const FacebookIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const SocialLinksForm = ({ userId, onSaved }: SocialLinksFormProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [youtubeHandle, setYoutubeHandle] = useState('');
  const [otherSocialLink, setOtherSocialLink] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    apiGetSportProfile(userId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setInstagramHandle(data.instagramHandle || '');
          setTiktokHandle(data.tiktokHandle || '');
          setFacebookHandle(data.facebookHandle || '');
          setYoutubeHandle(data.youtubeHandle || '');
          setOtherSocialLink(data.otherSocialLink || '');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('Falha ao carregar redes sociais:', err);
        setLoadError(err.message || 'Erro ao carregar redes sociais');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, retryKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    toast.loading('Salvando redes sociais...', { id: 'social-links' });

    try {
      const updated = await apiUpsertSportProfile(userId, {
        instagramHandle: instagramHandle.trim() || null,
        tiktokHandle: tiktokHandle.trim() || null,
        facebookHandle: facebookHandle.trim() || null,
        youtubeHandle: youtubeHandle.trim() || null,
        otherSocialLink: otherSocialLink.trim() || null,
      });

      toast.success('Redes sociais atualizadas!', { id: 'social-links' });
      if (updated && onSaved) onSaved(updated);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar redes sociais.', { id: 'social-links' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl card-shadow p-6 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Carregando redes sociais...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-card rounded-2xl card-shadow p-6 text-center space-y-4 border border-destructive/30">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Não foi possível carregar suas redes sociais</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Ocorreu uma falha ao consultar seus links salvos. Para sua segurança, a edição foi bloqueada para não sobrescrever seus dados.
          </p>
          <p className="text-[11px] text-destructive font-mono mt-2 bg-destructive/10 py-1 px-2.5 rounded-lg inline-block">
            {loadError}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl card-shadow p-5 space-y-5">
      <div className="border-b border-border pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold italic uppercase tracking-wider text-foreground">
            Redes Sociais
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Conecte seus perfis públicos. Você pode preencher seu @usuario ou o link completo.
        </p>
      </div>

      {/* Instagram */}
      <div>
        <label className="text-ui text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase mb-1.5">
          <Instagram className="w-4 h-4 text-accent" />
          Instagram
        </label>
        <input
          type="text"
          value={instagramHandle}
          onChange={(e) => setInstagramHandle(e.target.value)}
          placeholder="@seuperfil ou https://instagram.com/..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* TikTok */}
      <div>
        <label className="text-ui text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase mb-1.5">
          <TikTokIcon className="w-4 h-4 text-foreground" />
          TikTok
        </label>
        <input
          type="text"
          value={tiktokHandle}
          onChange={(e) => setTiktokHandle(e.target.value)}
          placeholder="@seuperfil ou https://tiktok.com/@..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* Facebook */}
      <div>
        <label className="text-ui text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase mb-1.5">
          <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
          Facebook
        </label>
        <input
          type="text"
          value={facebookHandle}
          onChange={(e) => setFacebookHandle(e.target.value)}
          placeholder="Nome de usuário ou https://facebook.com/..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* YouTube */}
      <div>
        <label className="text-ui text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase mb-1.5">
          <Youtube className="w-4 h-4 text-destructive" />
          YouTube
        </label>
        <input
          type="text"
          value={youtubeHandle}
          onChange={(e) => setYoutubeHandle(e.target.value)}
          placeholder="@canal ou https://youtube.com/@..."
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* Other */}
      <div>
        <label className="text-ui text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase mb-1.5">
          <Globe className="w-4 h-4 text-primary" />
          Outra rede ou link (Strava, LinkedIn, Blog)
        </label>
        <input
          type="text"
          value={otherSocialLink}
          onChange={(e) => setOtherSocialLink(e.target.value)}
          placeholder="https://strava.app.link/... ou perfil"
          className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
        />
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <motion.button
          type="submit"
          disabled={saving}
          whileHover={!saving ? { scale: 1.02 } : {}}
          whileTap={!saving ? { scale: 0.98 } : {}}
          transition={spring}
          className={`w-full py-3.5 rounded-xl font-bold btn-shadow flex items-center justify-center gap-2 text-ui text-xs transition-all ${
            saving
              ? 'bg-primary/70 text-primary-foreground cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
        >
          <Save size={16} />
          {saving ? 'SALVANDO REDES...' : 'SALVAR REDES SOCIAIS'}
        </motion.button>
      </div>
    </form>
  );
};
