import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import WinnerCard from '@/components/WinnerCard';
import { winners } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

const Winners = () => {
  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-2">
        GANHADORES — CAMPANHA ANTERIOR
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Os atletas que mostraram mais atitude, comprometimento e continuidade.
      </p>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid md:grid-cols-2 gap-6 mb-8"
      >
        {winners.map((w) => (
          <motion.div key={w.id} variants={fadeIn} transition={spring}>
            <WinnerCard winner={w} />
          </motion.div>
        ))}
      </motion.div>

      <div className="text-center">
        <Link to="/dashboard">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="bg-primary text-primary-foreground text-ui px-8 py-3 rounded-xl btn-shadow"
          >
            VER CAMPANHAS ATIVAS
          </motion.button>
        </Link>
      </div>
    </div>
  );
};

export default Winners;
