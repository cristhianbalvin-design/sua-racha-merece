import { postLoginDestination } from '@/lib/postLogin';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { clearAuthRedirect, getAuthRedirectFromLocation, persistAuthRedirect } from '@/lib/authRedirect';

export function useLoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const redirectTo = getAuthRedirectFromLocation(location);

  useEffect(() => {
    if (redirectTo) {
      persistAuthRedirect(redirectTo);
    }
  }, [redirectTo]);

  const { login, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Login bem-sucedido!');
      clearAuthRedirect();
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
      } else if (
        email.toLowerCase() === 'admin@3buk.com' ||
        email.toLowerCase() === 'cristhianbalvin@gmail.com'
      ) {
        navigate('/admin/usuarios');
      } else {
        navigate(postLoginDestination(redirectTo), { replace: Boolean(redirectTo) });
      }
    } catch (error: any) {
      const msg = error?.message || 'Erro ao entrar. Verifique suas credenciais.';
      toast.error(msg);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle(redirectTo || undefined);
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error('Erro ao entrar com Google: ' + (error?.message || 'Tente novamente.'));
    }
  };

  return { email, setEmail, password, setPassword, redirectTo, handleSubmit, handleGoogleLogin };
}
