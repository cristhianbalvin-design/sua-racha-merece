import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const PlanSelection = () => {
  const navigate = useNavigate();

  const handleSelect = () => {
    navigate('/completar-perfil');
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <h1 className="font-bold italic text-2xl text-foreground mt-4">ESCOLHA SEU PLANO</h1>
          <p className="text-muted-foreground mt-2">Comece grátis ou maximize suas chances.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            whileHover={{ y: -4 }}
            transition={spring}
            className="bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-shadow"
          >
            <h3 className="font-bold italic text-xl text-foreground mb-4">FREEMIUM</h3>
            <ul className="space-y-3 text-sm text-muted-foreground mb-6">
              <li>✓ Participa em campanhas</li>
              <li>✓ Prêmios de R$70 a R$200</li>
            </ul>
            <motion.button
              onClick={handleSelect}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full bg-muted text-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
            >
              ESCOLHER FREEMIUM
            </motion.button>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            transition={spring}
            className="bg-card rounded-2xl p-6 relative overflow-hidden transition-shadow"
            style={{ boxShadow: '0 0 0 2px hsl(var(--primary)), 0 8px 16px -4px hsl(0 0% 0% / 0.5)' }}
          >
            <span className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-md uppercase">
              Popular
            </span>
            <h3 className="font-bold italic text-xl text-foreground mb-4">PREMIUM</h3>
            <ul className="space-y-3 text-sm text-muted-foreground mb-6">
              <li>✓ Participa em campanhas</li>
              <li>✓ Maior probabilidade de prêmios maiores</li>
              <li>✓ Prêmios de R$200 a R$400</li>
            </ul>
            <motion.button
              onClick={handleSelect}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
            >
              ESCOLHER PREMIUM
            </motion.button>
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
