import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

// Links de convite (type=invite, ex.: fotógrafos) disparam SIGNED_IN e não PASSWORD_RECOVERY.
// Lido no carregamento do módulo, antes de o supabase-js limpar o hash da URL.
const ARRIVED_FROM_INVITE =
  typeof window !== 'undefined' &&
  window.location.pathname === '/reset-password' &&
  /(^|[#&?])type=invite(&|$)/.test(`${window.location.hash}&${window.location.search}`);

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [goesToPortal, setGoesToPortal] = useState(false);
  
  const { user, isRecovery } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isRecovery && !ARRIVED_FROM_INVITE) {
      navigate('/dashboard');
    }
  }, [user, isRecovery, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsVerifying(false);
      } else if (event === 'SIGNED_IN') {
        // If they sign in but it's not a recovery event, we could also just let them be, 
        // but typically recovery sets the session. The user requested to wait for PASSWORD_RECOVERY.
        // As a fallback if they arrive here with an active session from recovery:
        setIsVerifying(false);
      }
    });

    // Fallback: if we're already verified or if there's an error in the hash, we should stop verifying after a timeout
    const timer = setTimeout(() => {
      if (isVerifying) {
        setIsVerifying(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [isVerifying]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      // Fotógrafo convidado: termina no Portal do Fotógrafo, não no fluxo do atleta.
      let target = '/login';
      try {
        const { data: isPhotographer } = await supabase.rpc('is_photographer');
        if (isPhotographer === true) target = '/fotografo';
      } catch {
        // Sem a verificação, segue o fluxo padrão.
      }
      setGoesToPortal(target === '/fotografo');
      setSuccess(true);
      toast.success('Senha atualizada com sucesso!');
      setTimeout(() => {
        navigate(target);
      }, 2000);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin text-primary w-10 h-10 mb-4" />
          <p className="text-muted-foreground text-ui">Verificando link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <p className="text-muted-foreground mt-2">Criar nova senha</p>
        </div>

        {success ? (
          <div className="text-center bg-card card-shadow p-6 rounded-xl">
            <p className="text-green-500 font-bold mb-2">Senha atualizada com sucesso!</p>
            <p className="text-muted-foreground text-sm">
              {goesToPortal ? 'Redirecionando para o Portal do Fotógrafo...' : 'Redirecionando para o login...'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-2">NOVA SENHA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-2">CONFIRMAR NOVA SENHA</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              {errorMsg && <p className="text-destructive text-sm mt-2">{errorMsg}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.03 } : {}}
              whileTap={!loading ? { scale: 0.97 } : {}}
              transition={spring}
              className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow font-bold flex justify-center items-center opacity-disabled"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'ATUALIZAR SENHA'}
            </motion.button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
