import { useState } from 'react';
import { motion } from 'framer-motion';
import { sports } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminCreateCampaign = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">CRIAR CAMPANHA</h1>

      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success/20 text-success rounded-xl p-4 mb-6 text-sm font-bold text-center"
        >
          ✅ Campanha publicada com sucesso!
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-2">ESPORTE</label>
          <select
            className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
            required
          >
            <option value="">Selecione</option>
            {sports.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">REGIÃO</label>
            <input
              type="text"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="SP"
              required
            />
          </div>
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">CIDADE</label>
            <input
              type="text"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="São Paulo"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">DATA DE INÍCIO</label>
            <input
              type="date"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">DATA DE FIM</label>
            <input
              type="date"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-2">DESCRIÇÃO DO DESAFIO</label>
          <textarea
            className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all resize-none h-24"
            placeholder="Descreva o desafio da campanha..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">QTD GANHADORES</label>
            <input
              type="number"
              min="1"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="3"
              required
            />
          </div>
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">PRÊMIO</label>
            <input
              type="text"
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="Tênis Nike — R$350"
              required
            />
          </div>
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
        >
          PUBLICAR CAMPANHA
        </motion.button>
      </form>
    </div>
  );
};

export default AdminCreateCampaign;
