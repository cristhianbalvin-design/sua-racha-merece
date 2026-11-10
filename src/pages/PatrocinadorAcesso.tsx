import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { sponsorAccessView } from '@/lib/sponsorAccess';

// Conserva los parámetros antes de que Supabase limpie la URL.
const initialUrl = window.location.pathname === '/patrocinador/acesso'
  ? { search: window.location.search, hash: window.location.hash }
  : null;

export default function PatrocinadorAcesso() {
  const navigate = useNavigate();
  const [view, setView] = useState<'loading' | 'request' | 'password'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [link] = useState(() => initialUrl ?? { search: window.location.search, hash: window.location.hash });

  useEffect(() => {
    let active = true;
    void (async () => {
      let { data, error } = await supabase.auth.getSession();
      const code = new URLSearchParams(link.search).get('code');
      if (code && new URLSearchParams(window.location.search).has('code')) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        data = { session: exchanged.data.session };
        error = exchanged.error;
        if (!error && data.session) {
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          window.history.replaceState(window.history.state, '', url.toString());
        }
      }
      if (!active) return;
      const token = new URLSearchParams(link.hash.replace(/^#/, '')).get('access_token');
      const hadCode = new URLSearchParams(link.search).has('code');
      // Supabase elimina el código solo después de canjearlo correctamente.
      const codeExchanged = !hadCode || !new URLSearchParams(window.location.search).has('code');
      const validSession = !error && !!data.session && codeExchanged && (!token || data.session.access_token === token);
      setView(sponsorAccessView(link.search, link.hash, validSession));
    })();
    return () => { active = false; };
  }, [link]);

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await supabase.functions.invoke('invite-sponsor', { body: { action: 'resend', email } });
    } finally {
      setMessage('Se este e-mail pertence a uma equipe de patrocinador, enviamos um novo link.');
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      setMessage('Use pelo menos 8 caracteres e confirme a mesma senha.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage('Não foi possível criar sua senha. Tente novamente.');
    else navigate('/patrocinador', { replace: true });
  };

  const inputClass = 'w-full rounded-lg bg-input px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring';
  const buttonClass = 'w-full rounded-xl bg-primary p-3 font-bold text-primary-foreground disabled:opacity-50';
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-background p-5 text-foreground">
      {view === 'loading' ? <p>Carregando…</p> : view === 'request' ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">O link expirou ou já foi usado</h1>
          <p>Para acessar sua equipe de patrocinador, informe seu e-mail e peça um novo link.</p>
          <form className="space-y-4" onSubmit={requestLink}>
            <label className="block">E-mail<input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className={buttonClass} disabled={busy}>Pedir novo link</button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Crie sua senha</h1>
          <p>Crie uma senha para entrar novamente na sua conta.</p>
          <form className="space-y-4" onSubmit={savePassword}>
            <label className="block">Senha<input className={inputClass} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="block">Confirme sua senha<input className={inputClass} type="password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
            <button className={buttonClass} disabled={busy}>Criar senha</button>
          </form>
          <Link className="block rounded-xl border p-3 text-center font-bold" to="/patrocinador">Pular por agora</Link>
        </div>
      )}
      {message && <p className="mt-4" role="status">{message}</p>}
    </main>
  );
}
