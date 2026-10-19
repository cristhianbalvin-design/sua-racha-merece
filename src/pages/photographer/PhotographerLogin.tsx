import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePhotographer } from '@/hooks/usePhotographer';
import { PortalShell, PortalSpinner } from '@/components/photographer/PortalShell';
import NotPhotographerNotice from '@/components/photographer/NotPhotographerNotice';

const inputClass =
  'w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all';

const PhotographerLogin = () => {
  const { login } = useAuth();
  const { loading, authUserId, email: sessionEmail, isPhotographer, refresh, signOut } = usePhotographer();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith('/fotografo') && !from.startsWith('/fotografo/login') ? from : '/fotografo';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (loading && !submitting) return <PortalSpinner />;
  if (!submitting && authUserId && isPhotographer) return <Navigate to={target} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const snap = await refresh();
      if (snap.isPhotographer) {
        navigate(target, { replace: true });
        return;
      }
      // Não é fotógrafo: fica nesta tela e mostra o aviso (não entra no portal).
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErrorMsg(/invalid login credentials/i.test(msg) ? 'E-mail ou senha incorretos.' : msg || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const showNotice = !submitting && !loading && authUserId && !isPhotographer;

  return (
    <PortalShell>
      {showNotice ? (
        <NotPhotographerNotice email={sessionEmail} onSignOut={() => signOut()} />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-ui text-xs text-primary">PORTAL DO FOTÓGRAFO</p>
            <h1 className="font-bold italic text-2xl text-foreground mt-1">Suas fotos, encontradas pelos atletas.</h1>
            <p className="text-sm text-muted-foreground mt-2">Envie suas fotos de eventos e acompanhe a aprovação.</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card rounded-2xl card-shadow p-5 space-y-4">
            <div>
              <label htmlFor="ph-email" className="text-ui text-xs text-muted-foreground block mb-2">E-MAIL</label>
              <input id="ph-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} disabled={submitting} />
            </div>
            <div>
              <label htmlFor="ph-pass" className="text-ui text-xs text-muted-foreground block mb-2">SENHA</label>
              <input id="ph-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} disabled={submitting} />
            </div>
            {errorMsg && <p className="text-destructive text-sm" role="alert">{errorMsg}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow font-bold flex justify-center items-center disabled:opacity-70"
            >
              {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'ENTRAR'}
            </button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">Esqueci minha senha</Link>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            O acesso ao portal é por convite. Ainda não recebeu o e-mail para definir sua senha? Fale com a equipe 3BUK.
          </p>
        </div>
      )}
    </PortalShell>
  );
};

export default PhotographerLogin;
