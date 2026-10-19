import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';

/** Tela simples do portal (login, termos, avisos): logo + cartão central. */
export const PortalShell = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <div className="min-h-svh bg-background flex flex-col">
    <header className="px-4 md:px-8 py-4 flex items-center gap-3" style={{ boxShadow: '0 1px 0 hsl(var(--border))' }}>
      <Link to="/fotografo" aria-label="Portal do fotógrafo">
        <Logo size="sm" />
      </Link>
      <span className="text-ui text-[11px] text-muted-foreground">PORTAL DO FOTÓGRAFO</span>
    </header>
    <main className={`flex-1 w-full mx-auto px-4 py-8 md:py-12 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>{children}</main>
  </div>
);

export const PortalSpinner = () => (
  <div className="min-h-svh bg-background flex items-center justify-center">
    <Loader2 className="animate-spin text-primary w-8 h-8" aria-label="Carregando" />
  </div>
);
