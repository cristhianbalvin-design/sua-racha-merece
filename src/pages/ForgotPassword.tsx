import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccess(true);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <p className="text-muted-foreground mt-2">Recuperar senha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">E-MAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="seu@email.com"
              required
              disabled={loading || success}
            />
            {errorMsg && <p className="text-destructive text-sm mt-2">{errorMsg}</p>}
            {success && <p className="text-green-500 text-sm mt-2">Verifique seu email, enviamos um link de recuperação.</p>}
          </div>

          <motion.button
            type="submit"
            disabled={loading || success}
            whileHover={!loading && !success ? { scale: 1.03 } : {}}
            whileTap={!loading && !success ? { scale: 0.97 } : {}}
            transition={spring}
            className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow font-bold flex justify-center items-center opacity-disabled"
            style={{ opacity: loading || success ? 0.7 : 1 }}
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'ENVIAR LINK DE RECUPERAÇÃO'}
          </motion.button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
