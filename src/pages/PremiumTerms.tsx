import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PREMIUM_TERMS_SECTIONS, PREMIUM_TERMS_TITLE } from '@/content/premiumTerms';

/** Página pública com os Termos de Compra do Premium (link do checkout). */
const PremiumTerms = () => (
  <div className="min-h-screen bg-background text-foreground px-4 md:px-8 py-8">
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/creditos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="font-bold italic text-2xl">{PREMIUM_TERMS_TITLE}</h1>
      <div className="bg-card rounded-2xl card-shadow p-5 space-y-5">
        {PREMIUM_TERMS_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-bold text-foreground">{s.title}</h2>
            <p className="text-sm mt-1 whitespace-pre-line text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  </div>
);

export default PremiumTerms;
