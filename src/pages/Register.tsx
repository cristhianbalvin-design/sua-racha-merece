import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingStepper } from '@/components/OnboardingStepper';
import { TermsModal } from '@/components/TermsModal';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register, loginWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error('Google auth error:', error);
      toast.error('Erro ao entrar com Google: ' + (error?.message || 'Tente novamente.'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setErrorMsg('Você precisa aceitar os Termos e Condições para continuar.');
      toast.error('Você precisa aceitar os Termos e Condições para continuar.');
      return;
    }
    setErrorMsg('');
    try {
      await register(email, password, 'Atleta', acceptedTerms);
      sessionStorage.setItem('isNewUserFlow', 'true');
      toast.success('Conta criada com sucesso!');
      navigate('/completar-perfil');
    } catch (error: any) {
      console.error("Erro no signUp:", error);
      toast.error(`Erro ao criar conta: ${error.message || 'Tente novamente.'}`);
    }
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <OnboardingStepper currentStep={1} />
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-muted-foreground mt-2">Crie sua conta e comece a competir</p>
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
            />
          </div>
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">SENHA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <motion.button
            type="submit"
            whileHover={acceptedTerms ? { scale: 1.03 } : {}}
            whileTap={acceptedTerms ? { scale: 0.97 } : {}}
            transition={spring}
            className={`w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-all flex items-center justify-center font-bold ${
              !acceptedTerms ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            CRIAR CONTA
          </motion.button>

          <div className="flex flex-col gap-1 py-1">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  if (e.target.checked) setErrorMsg('');
                }}
                className="mt-1 cursor-pointer w-4 h-4 rounded border-border bg-input text-primary focus:ring-ring focus:ring-offset-background accent-primary"
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground select-none cursor-pointer leading-tight">
                Li e aceito os{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-primary font-bold hover:underline bg-transparent border-none p-0 inline cursor-pointer"
                >
                  Termos e Condições
                </button>
              </label>
            </div>
            {errorMsg && (
              <span className="text-destructive text-xs mt-1 block animate-in fade-in slide-in-from-top-1">
                {errorMsg}
              </span>
            )}
          </div>

          <motion.button
            type="button"
            onClick={handleGoogleLogin}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="w-full bg-card text-foreground text-ui py-3 rounded-xl card-shadow hover:card-shadow-hover transition-shadow font-bold"
          >
            ENTRAR COM GOOGLE
          </motion.button>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary font-bold">Entrar</Link>
        </p>
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAcceptedTerms(true);
          setErrorMsg('');
        }}
      />
    </div>
  );
};

export default Register;
