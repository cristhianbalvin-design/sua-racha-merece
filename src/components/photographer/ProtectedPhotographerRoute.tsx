import { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { usePhotographer } from '@/hooks/usePhotographer';
import NotPhotographerNotice from './NotPhotographerNotice';
import { PortalShell, PortalSpinner } from './PortalShell';

interface Props {
  children: ReactNode;
  /** true só na tela de termos: deixa entrar quem ainda não aceitou. */
  allowPendingTerms?: boolean;
}

const ProtectedPhotographerRoute = ({ children, allowPendingTerms = false }: Props) => {
  const { loading, error, authUserId, email, isPhotographer, profile, refresh, signOut } = usePhotographer();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <PortalSpinner />;

  if (error) {
    return (
      <PortalShell>
        <div className="bg-card rounded-2xl card-shadow p-6 text-center space-y-4">
          <p className="text-foreground">{error}</p>
          <button type="button" onClick={() => refresh()} className="bg-primary text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl font-bold">
            TENTAR NOVAMENTE
          </button>
        </div>
      </PortalShell>
    );
  }

  if (!authUserId) {
    return <Navigate to="/fotografo/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!isPhotographer || !profile) {
    return (
      <PortalShell>
        <NotPhotographerNotice
          email={email}
          onSignOut={async () => {
            await signOut();
            navigate('/fotografo/login', { replace: true });
          }}
        />
      </PortalShell>
    );
  }

  if (!profile.terms_accepted_at && !allowPendingTerms) {
    return <Navigate to="/fotografo/termos" replace />;
  }

  return <>{children}</>;
};

export default ProtectedPhotographerRoute;
