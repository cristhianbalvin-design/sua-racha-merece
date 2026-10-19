import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';

interface Props {
  email?: string | null;
  onSignOut: () => void;
}

/** Aviso para contas logadas que não são de fotógrafo (por exemplo, atletas). */
const NotPhotographerNotice = ({ email, onSignOut }: Props) => (
  <div className="bg-card rounded-2xl card-shadow p-6 text-center space-y-4">
    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
      <Camera size={22} />
    </div>
    <div>
      <h1 className="font-bold italic text-xl text-foreground">Esta conta não é de fotógrafo</h1>
      <p className="text-sm text-muted-foreground mt-2">
        {email ? <>Você entrou como <span className="text-foreground">{email}</span>. </> : null}
        O Portal do Fotógrafo é só para fotógrafos convidados pela equipe 3BUK.
      </p>
    </div>
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <Link to="/dashboard" className="bg-primary text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl btn-shadow font-bold">
        IR PARA A ÁREA DO ATLETA
      </Link>
      <button type="button" onClick={onSignOut} className="bg-muted text-foreground text-ui text-xs px-5 py-3 rounded-xl font-bold">
        SAIR E ENTRAR COM OUTRA CONTA
      </button>
    </div>
  </div>
);

export default NotPhotographerNotice;
