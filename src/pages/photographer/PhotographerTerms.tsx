import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePhotographer } from '@/hooks/usePhotographer';
import { PortalShell } from '@/components/photographer/PortalShell';
import { apiAcceptPhotographerTerms } from '@/lib/photographerApi';
import { PHOTOGRAPHER_TERMS_SECTIONS, PHOTOGRAPHER_TERMS_TITLE } from '@/content/photographerTerms';

const PhotographerTerms = () => {
  const { profile, markTermsAccepted } = usePhotographer();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  if (profile?.terms_accepted_at) return <Navigate to="/fotografo" replace />;

  const handleAccept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      const acceptedAt = await apiAcceptPhotographerTerms();
      markTermsAccepted(acceptedAt || new Date().toISOString());
      toast.success('Termos aceitos. Bem-vindo ao portal!');
      navigate('/fotografo', { replace: true });
    } catch (err) {
      console.error('accept_photographer_terms:', err);
      toast.error('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell wide>
      <div className="space-y-6">
        <div>
          <p className="text-ui text-xs text-primary">PRIMEIRO ACESSO</p>
          <h1 className="font-bold italic text-2xl text-foreground mt-1">{PHOTOGRAPHER_TERMS_TITLE}</h1>
          <p className="text-sm text-muted-foreground mt-2">Leia e aceite para começar a enviar fotos. Você só precisa fazer isso uma vez.</p>
        </div>

        <div className="bg-card rounded-2xl card-shadow p-5 max-h-[50vh] overflow-y-auto space-y-5">
          {PHOTOGRAPHER_TERMS_SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-bold text-foreground">{s.title}</h2>
              <p className="text-sm mt-1 whitespace-pre-line text-accent font-bold">{s.body}</p>
            </section>
          ))}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm text-foreground">Li e aceito os Termos do Fotógrafo da 3BUK.</span>
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!checked || saving}
            className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow font-bold flex justify-center items-center disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : 'ACEITAR E CONTINUAR'}
          </button>
          <p className="text-xs text-muted-foreground text-center">Sem o aceite não é possível enviar fotos.</p>
        </div>
      </div>
    </PortalShell>
  );
};

export default PhotographerTerms;
