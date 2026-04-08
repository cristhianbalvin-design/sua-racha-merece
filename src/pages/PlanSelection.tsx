import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { OnboardingStepper } from '@/components/OnboardingStepper';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const PlanSelection = () => {
  const navigate = useNavigate();

  const handleSelect = () => {
    navigate('/completar-perfil');
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <OnboardingStepper currentStep={2} />
        <div className="text-center mb-8">
          <Logo size="lg" />
          <h1 className="font-bold italic text-2xl text-foreground mt-4">ESCOLHA SEU PLANO</h1>
          <p className="text-muted-foreground mt-2">Comece grátis ou maximize suas chances.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={spring}
            className="bg-card rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all flex flex-col border border-border/50"
          >
            <h3 className="font-bold italic text-xl text-foreground mb-4">FREEMIUM</h3>
            <ul className="space-y-3 text-sm text-muted-foreground mb-8 flex-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Participa em campanhas</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Prêmios de R$70 a R$200</li>
            </ul>
            <motion.button
              onClick={handleSelect}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full bg-muted/80 hover:bg-muted text-foreground text-ui py-4 rounded-xl btn-shadow transition-colors"
            >
               COMEÇAR GRÁTIS
            </motion.button>
          </motion.div>

          <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            transition={spring}
            className="bg-card rounded-2xl p-8 relative overflow-hidden transition-all group flex flex-col"
            style={{ 
              boxShadow: '0 0 0 2px hsl(var(--primary)), 0 10px 30px -10px hsl(var(--primary) / 0.4)' 
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex flex-col h-full">
              <span className="absolute -top-8 -right-8 bg-primary text-primary-foreground text-xs font-bold px-10 py-1.5 rotate-45 uppercase shadow-sm">
                Popular
              </span>
              <h3 className="font-bold italic text-2xl text-primary mb-4 flex items-center gap-2">
                PREMIUM <span className="text-xl">⭐</span>
              </h3>
              <ul className="space-y-3 text-sm text-foreground/90 mb-8 flex-1">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Participa em todas as campanhas</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Maior probabilidade de prêmios</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Prêmios de R$200 a R$400</li>
              </ul>
              <motion.button
                onClick={handleSelect}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="w-full bg-primary text-primary-foreground text-ui py-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-shadow"
              >
                ESCOLHER PREMIUM
              </motion.button>
            </div>
          </motion.div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Você pode mudar de plano a qualquer momento.
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;
