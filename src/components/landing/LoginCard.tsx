import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLoginForm } from '@/hooks/useLoginForm';

export function LoginCard() {
  const { email, setEmail, password, setPassword, redirectTo, handleSubmit, handleGoogleLogin } =
    useLoginForm();
  const [visible, setVisible] = useState(false);
  return (
    <form id="acesso" className="l-login" onSubmit={handleSubmit}>
      <h2>ACESSE SUA CONTA</h2>
      <label className="l-sr" htmlFor="landing-email">
        E-mail
      </label>
      <input
        id="landing-email"
        type="email"
        placeholder="E-mail"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="l-password">
        <label className="l-sr" htmlFor="landing-password">
          Senha
        </label>
        <input
          id="landing-password"
          type={visible ? 'text' : 'password'}
          placeholder="Senha"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <button className="l-button" type="submit">
        ENTRAR →
      </button>
      <div className="l-or">ou</div>
      <button type="button" className="l-google" onClick={handleGoogleLogin}>
        <span>G</span> Entrar com Google
      </button>
      <Link className="l-forgot" to="/forgot-password">
        Esqueceu sua senha?
      </Link>
      <p>
        Primeira vez?{' '}
        <Link to="/registro" state={redirectTo ? { redirectTo } : undefined}>
          Criar conta
        </Link>
      </p>
    </form>
  );
}
