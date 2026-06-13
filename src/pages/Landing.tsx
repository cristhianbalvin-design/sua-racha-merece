import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import WinnerCard from '@/components/WinnerCard';
import { apiGetActiveHomePopup, apiGetWinners } from '@/lib/mockApi';
import type { HomePopup } from '@/data/mockData';
import heroImg from '@/assets/Comunidad 3buk.png';
import heroImgMobile from '@/assets/Comunidad 3buk mobile.png';
import { Activity, Bike, CheckCircle, Dumbbell, Flame, Footprints, Goal, Shield, Trophy, Waves, Calendar, X } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };
const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const SHOW_PAID_PLANS = false;

const Landing = () => {
  const navigate = useNavigate();
  const [latestWinners, setLatestWinners] = useState<any[]>([]);
  const [activePopup, setActivePopup] = useState<HomePopup | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) {
      navigate('/login', { replace: true });
      return;
    }
    apiGetWinners().then((data) => {
      // Get the latest 8 winners and assign them ordered medals (optional, just for visual flair)
      const latest = [...data].reverse().slice(0, 8);
      const medals = ['🥇', '🥈', '🥉'];
      const withCarouselMedals = latest.map((w, idx) => ({ ...w, medal: medals[idx % 3] }));
      setLatestWinners(withCarouselMedals);
    });
    apiGetActiveHomePopup().then((popup) => {
      if (!popup) return;
      if (sessionStorage.getItem(`home-popup-dismissed-${popup.id}`)) return;
      setActivePopup(popup);
    });
  }, [navigate]);

  const closePopup = () => {
    if (activePopup) {
      sessionStorage.setItem(`home-popup-dismissed-${activePopup.id}`, 'true');
    }
    setActivePopup(null);
  };

  return (
    <div className="min-h-svh bg-background">
      {activePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 backdrop-blur-sm px-3 md:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="relative w-full max-w-[min(92vw,860px)] overflow-hidden rounded-2xl border border-border bg-card card-shadow"
          >
            <button
              onClick={closePopup}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/95 text-foreground border border-border card-shadow hover:bg-muted transition-colors"
              aria-label="Fechar popup"
            >
              <X size={18} />
            </button>
            <img
              src={activePopup.imageUrl}
              alt={activePopup.name}
              className="w-full aspect-[4/3] max-h-[72vh] object-cover bg-card"
            />
            <div className="grid grid-cols-1 gap-3 bg-card p-3 sm:grid-cols-2 sm:p-4">
              <Link to="/registro" onClick={closePopup}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  className="w-full rounded-xl bg-primary px-5 py-3 text-ui text-sm font-bold text-primary-foreground btn-shadow hover:btn-shadow-hover"
                >
                  REGISTRAR NOVO USUÁRIO
                </motion.button>
              </Link>
              <Link to="/login" onClick={closePopup}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  className="w-full rounded-xl bg-muted px-5 py-3 text-ui text-sm font-bold text-foreground hover:bg-muted/80"
                >
                  INICIAR SESI&Oacute;N
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      )}
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-4">

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
      <section className="relative overflow-hidden min-h-[600px] md:min-h-[800px] lg:min-h-[90vh] flex items-center">
        <div className="absolute inset-0">
          <picture>
            <source media="(max-width: 767px)" srcSet={heroImgMobile} />
            <source media="(min-width: 768px)" srcSet={heroImg} />
            <img src={heroImg} alt="Grupo de atletas" className="w-full h-full object-cover object-center" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-background/40 to-transparent md:from-background md:via-background/50 md:to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent md:from-background md:via-background/10" />
        </div>
        <div className="relative px-4 md:px-8 py-20 w-full max-w-7xl mx-auto text-left">
          <div className="max-w-2xl">
            <motion.h1
              {...fadeIn}
              transition={{ ...spring, delay: 0.1 }}
              className="text-display font-bold italic text-foreground mb-6 leading-tight"
            >
              SEU ESFORÇO MERECE <span className="text-primary">PATROCÍNIO.</span>
            </motion.h1>
            <motion.p
              {...fadeIn}
              transition={{ ...spring, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8"
            >
              Plataforma que patrocina atletas amadores no Brasil.
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

      {/* O que e a 3BUK */}
      <section className="px-4 md:px-8 py-14 bg-background">
        <motion.div
          {...fadeIn}
          transition={{ ...spring, delay: 0.1 }}
          className="max-w-4xl mx-auto border-y border-primary/30 py-12"
        >
          <div className="flex flex-col items-center text-center gap-8">
            <div>
              <p className="text-ui text-xs text-primary font-bold mb-3">3BUK</p>
              <h2 className="font-bold italic text-3xl md:text-4xl text-foreground leading-tight">
                O que é a <span className="text-primary">3BUK?</span>
              </h2>
            </div>
            <div className="max-w-2xl">
              <p className="text-xl md:text-2xl text-foreground font-bold italic leading-snug">
                A 3BUK é uma marca que patrocina atletas amadores com base em
                <span className="text-primary"> compromisso</span>,
                <span className="text-secondary"> continuidade</span> e
                <span className="text-accent"> atitude</span>.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-8">
                {['Compromisso', 'Continuidade', 'Atitude'].map((item) => (
                  <div key={item} className="bg-card border border-border rounded-lg px-4 py-4 text-center">
                    <span className="text-ui text-[10px] md:text-xs text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
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
            { step: '01', icon: <CheckCircle className="text-primary" size={28} />, title: 'Você entra', desc: 'Crie seu perfil e escolha como quer competir.' },
            { step: '02', icon: <Dumbbell className="text-secondary" size={28} />, title: 'Você participa', desc: 'Entre nas campanhas e mostre seu esporte com atitude.' },
            { step: '03', icon: <Flame className="text-accent" size={28} />, title: 'Você pode ser patrocinado', desc: 'A 3BUK avalia compromisso, continuidade e atitude para premiar atletas amadores.' },
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
        <p className="text-center text-muted-foreground font-bold italic mt-8">
          Nem todos serão escolhidos.
        </p>
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

      {/* Beneficio claro */}
      <section className="px-4 md:px-8 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-ui text-xs text-primary font-bold mb-3">BENEFÍCIO CLARO</p>
          <h2 className="font-bold italic text-2xl md:text-3xl text-foreground">O que você ganha</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {['Participação', 'Visibilidade', 'Oportunidade de patrocínio'].map((benefit) => (
            <div key={benefit} className="bg-card border border-border rounded-xl px-5 py-6 text-center card-shadow">
              <p className="font-bold italic text-lg text-foreground">{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Esportes */}
      <section className="px-4 md:px-8 pb-16 max-w-6xl mx-auto">
        <div className="bg-card border border-border rounded-2xl overflow-hidden card-shadow">
          <div className="grid lg:grid-cols-[1fr_1.6fr]">
            <div className="bg-foreground text-background p-8 md:p-10 flex flex-col justify-center">
              <p className="text-ui text-xs text-primary font-bold mb-3">ESPORTES</p>
              <h2 className="font-bold italic text-3xl md:text-4xl leading-tight mb-5">
                Todos os esportes.
              </h2>
              <p className="text-base md:text-lg font-bold leading-relaxed">
                Se você treina, você pode participar.
              </p>
            </div>

            <div className="p-8 md:p-10 grid grid-cols-2 sm:grid-cols-4 gap-5 content-center">
              {[
                { icon: <Footprints size={28} />, label: 'Corrida' },
                { icon: <Bike size={28} />, label: 'Ciclismo' },
                { icon: <Waves size={28} />, label: 'Surf' },
                { icon: <Dumbbell size={28} />, label: 'Crossfit' },
                { icon: <Activity size={28} />, label: 'Triatlo' },
                { icon: <Goal size={28} />, label: 'Futebol' },
                { icon: <Trophy size={28} />, label: 'Skate' },
                { icon: <Flame size={28} />, label: 'Outro' },
              ].map((sport) => (
                <div key={sport.label} className="flex flex-col items-center justify-center gap-2 min-h-20 text-muted-foreground">
                  <div className="text-foreground">{sport.icon}</div>
                  <span className="text-ui text-[10px] text-center">{sport.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="text-center mt-10">
          <p className="font-bold italic text-2xl md:text-4xl text-foreground leading-tight mb-6">
            Seu esforço pode ser reconhecido.
          </p>
          <Link to="/registro">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="bg-primary text-primary-foreground text-ui px-10 py-4 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow text-sm font-bold"
            >
              QUERO MEU PATROCÍNIO
            </motion.button>
          </Link>
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

      {/* Planos kept for later; hidden while paid plans are paused. */}
      {SHOW_PAID_PLANS && (
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
      )}

      {/* Footer */}
      <footer className="px-4 md:px-8 py-12 text-center">
        <Logo size="md" />
        <p className="text-muted-foreground text-sm mt-3">Seu esforço merece patrocínio.</p>
        <p className="text-muted-foreground text-xs mt-2">#3bukchallenge</p>
      </footer>
    </div>
  );
};

export default Landing;
// Force HMR 
