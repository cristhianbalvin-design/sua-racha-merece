import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import WinnerCard from '@/components/WinnerCard';
import { apiGetWinners } from '@/lib/mockApi';
import heroImg from '@/assets/hero-running.jpg';
import { CheckCircle, Flame, Dumbbell, Shield, Calendar } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };
const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };

const Landing = () => {
  const [latestWinners, setLatestWinners] = useState<any[]>([]);

  useEffect(() => {
    apiGetWinners().then((data) => {
      // Get the latest 8 winners and assign them ordered medals (optional, just for visual flair)
      const latest = [...data].reverse().slice(0, 8);
      const medals = ['🥇', '🥈', '🥉'];
      const withCarouselMedals = latest.map((w, idx) => ({ ...w, medal: medals[idx % 3] }));
      setLatestWinners(withCarouselMedals);
    });
  }, []);

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
      <section className="relative overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Grupo de atletas" className="w-full h-full object-cover object-top opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 md:via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
        <div className="relative px-4 md:px-8 py-20 w-full max-w-7xl mx-auto text-left">
          <div className="max-w-2xl">
            <motion.h1
              {...fadeIn}
              transition={{ ...spring, delay: 0.1 }}
              className="text-display font-bold italic text-foreground mb-6 leading-tight"
            >
              TODOS COMEÇAM IGUAIS.<br /><span className="text-primary">SÓ A ATITUDE DECIDE.</span>
            </motion.h1>
            <motion.p
              {...fadeIn}
              transition={{ ...spring, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8"
            >
              Mostre sua atitude, participe de campanhas<br />
              e ganhe <strong className="text-foreground">recompensas</strong> reais com a <strong className="text-primary italic">3BUK</strong>.
            </motion.p>
            <motion.div {...fadeIn} transition={{ ...spring, delay: 0.3 }}>
              <Link to="/registro">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="bg-primary text-primary-foreground text-ui px-8 py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-base font-bold"
                >
                  QUERO MEU PATROCÍNIO
                </motion.button>
              </Link>
            </motion.div>
          </div>
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
              { icon: <Flame className="text-accent" size={32} />, title: 'Atitude', desc: 'Como você aparece na comunidade' },
              { icon: <Dumbbell className="text-secondary" size={32} />, title: 'Comprometimento', desc: 'Se você propõe um desafio e cumpre' },
              { icon: <Calendar className="text-primary" size={32} />, title: 'Continuidade', desc: 'Se você participa de forma constante, mesmo sem ganhar' },
            ].map((item) => (
              <div key={item.title} className="bg-card rounded-2xl p-6 card-shadow">
                <div className="mb-3">{item.icon}</div>
                <h3 className="font-bold italic text-lg text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ganhadores */}
      <section className="py-16 w-full overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 md:px-8 mb-8">
          <h2 className="font-bold italic text-2xl md:text-3xl text-foreground text-center">GANHADORES DAS ÚLTIMAS CAMPANHAS</h2>
        </div>
        
        {latestWinners.length === 0 ? (
          <p className="text-center text-muted-foreground">Ainda não há ganhadores registrados.</p>
        ) : (
          <div className="w-full">
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
            <div 
              className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 px-4 md:px-8 scrollbar-hide" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Fake empty element to add left margin while scrolling inside full window */}
              <div className="shrink-0 w-1 md:w-[calc((100vw-64rem)/2)] hidden md:block" />
              
              {latestWinners.map((w) => (
                <div key={w.id} className="snap-center xl:snap-start shrink-0 w-[85vw] sm:w-[400px] md:w-[450px]">
                  <WinnerCard winner={w} />
                </div>
              ))}
              
              {/* Fake empty element to add right margin */}
              <div className="shrink-0 w-1 md:w-[calc((100vw-64rem)/2)] hidden md:block" />
            </div>
          </div>
        )}
      </section>

      {/* Planos */}
      <section className="px-4 md:px-8 py-16 bg-card/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-bold italic text-2xl md:text-3xl text-foreground mb-8 text-center">PLANOS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={spring}
              className="bg-card rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all flex flex-col border border-border/50 text-left"
            >
              <h3 className="font-bold italic text-xl text-foreground mb-4">FREEMIUM</h3>
              <ul className="space-y-3 text-sm text-muted-foreground mb-8 flex-1">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Participa em campanhas</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Prêmios de R$70 a R$200</li>
              </ul>
              <Link to="/registro">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full bg-muted/80 hover:bg-muted text-foreground text-ui py-4 rounded-xl btn-shadow transition-colors"
                >
                  COMEÇAR GRÁTIS
                </motion.button>
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              transition={spring}
              className="bg-card rounded-2xl p-8 relative overflow-hidden transition-all group flex flex-col text-left"
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
                <Link to="/registro">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    className="w-full bg-primary text-primary-foreground text-ui py-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-shadow"
                  >
                    ESCOLHER PREMIUM
                  </motion.button>
                </Link>
              </div>
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
// Force HMR 
