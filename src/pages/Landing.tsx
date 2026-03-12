import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import WinnerCard from '@/components/WinnerCard';
import { winners } from '@/data/mockData';
import heroImg from '@/assets/hero-running.jpg';
import { CheckCircle, Flame, Dumbbell, Shield } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };
const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };

const Landing = () => {
  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="text-ui text-xs text-muted-foreground flex items-center gap-1.5"
            >
              <Shield size={14} />
              ADMIN
            </motion.button>
          </Link>
          <Link to="/login">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="text-ui text-sm text-primary"
            >
              ENTRAR
            </motion.button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Atleta correndo" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
        <div className="relative px-4 md:px-8 py-20 md:py-32 max-w-3xl mx-auto text-center">
          <motion.h1
            {...fadeIn}
            transition={{ ...spring, delay: 0.1 }}
            className="text-display font-bold italic text-foreground mb-6"
          >
            SUA RACHA<br />É SEU MÉRITO.
          </motion.h1>
          <motion.p
            {...fadeIn}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg text-muted-foreground mb-8 max-w-md mx-auto"
          >
            A plataforma que premia quem aparece. Participe de campanhas, mostre sua atitude e ganhe patrocínios reais.
          </motion.p>
          <motion.div {...fadeIn} transition={{ ...spring, delay: 0.3 }}>
            <Link to="/registro">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="bg-primary text-primary-foreground text-ui px-8 py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-base"
              >
                QUERO PARTICIPAR
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-4 md:px-8 py-16 max-w-5xl mx-auto">
        <h2 className="font-bold italic text-2xl md:text-3xl text-foreground mb-8 text-center">COMO FUNCIONA</h2>
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            { step: '01', icon: <CheckCircle className="text-primary" size={28} />, title: 'Crie seu perfil', desc: 'Cadastre-se e escolha seu plano.' },
            { step: '02', icon: <Dumbbell className="text-secondary" size={28} />, title: 'Participe de uma campanha', desc: 'Envie sua foto praticando seu esporte favorito.' },
            { step: '03', icon: <Flame className="text-accent" size={28} />, title: 'Ganhe patrocínios', desc: 'O admin avalia e você pode ganhar prêmios reais.' },
          ].map((item) => (
            <motion.div
              key={item.step}
              variants={fadeIn}
              transition={spring}
              className="bg-card rounded-2xl p-6 card-shadow"
            >
              <span className="text-ui text-xs text-muted-foreground mb-4 block">{item.step}</span>
              <div className="mb-3">{item.icon}</div>
              <h3 className="font-bold italic text-lg text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Criterios */}
      <section className="px-4 md:px-8 py-16 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bold italic text-2xl md:text-3xl text-foreground mb-8 text-center">COMO AVALIAMOS</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔥', title: 'Atitude', desc: 'Como você aparece na comunidade' },
              { icon: '💪', title: 'Comprometimento', desc: 'Se você propõe um desafio e cumpre' },
              { icon: '📅', title: 'Continuidade', desc: 'Se você participa de forma constante, mesmo sem ganhar' },
            ].map((item) => (
              <div key={item.title} className="bg-card rounded-2xl p-6 card-shadow">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold italic text-lg text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ganhadores */}
      <section className="px-4 md:px-8 py-16 max-w-5xl mx-auto">
        <h2 className="font-bold italic text-2xl md:text-3xl text-foreground mb-8 text-center">GANHADORES DA ÚLTIMA CAMPANHA</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {winners.map((w) => (
            <WinnerCard key={w.id} winner={w} />
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="px-4 md:px-8 py-16 bg-card/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-bold italic text-2xl md:text-3xl text-foreground mb-8 text-center">PLANOS</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl p-6 card-shadow">
              <h3 className="font-bold italic text-xl text-foreground mb-4">FREEMIUM</h3>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li>✓ Participa em campanhas</li>
                <li>✓ Prêmios de R$70 a R$200</li>
              </ul>
              <Link to="/registro">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full bg-muted text-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
                >
                  ESCOLHER FREEMIUM
                </motion.button>
              </Link>
            </div>
            <motion.div
              className="bg-card rounded-2xl p-6 card-shadow relative overflow-hidden"
              style={{ boxShadow: '0 0 0 2px hsl(var(--primary)), 0 8px 16px -4px hsl(0 0% 0% / 0.5)' }}
            >
              <span className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-md uppercase">Popular</span>
              <h3 className="font-bold italic text-xl text-foreground mb-4">PREMIUM</h3>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li>✓ Participa em campanhas</li>
                <li>✓ Maior probabilidade de prêmios maiores</li>
                <li>✓ Prêmios de R$200 a R$400</li>
              </ul>
              <Link to="/registro">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
                >
                  ESCOLHER PREMIUM
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-12 text-center">
        <Logo size="md" />
        <p className="text-muted-foreground text-sm mt-3">Sua racha é seu mérito.</p>
        <p className="text-muted-foreground text-xs mt-2">#3bukchallenge</p>
      </footer>
    </div>
  );
};

export default Landing;
