import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { sports } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminCreateCampaign = () => {
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState('Ambos');
  const [igOptional, setIgOptional] = useState(false);
  const [igHashtags, setIgHashtags] = useState('#3bukchallenge');

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

        {/* Plan selection */}
        <div>
          <label className="text-ui text-xs text-muted-foreground block mb-2">TIPO DE PLANO</label>
          <div className="flex gap-3">
            {['Freemium', 'Premium', 'Ambos'].map((p) => (
              <motion.button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors ${
                  plan === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {p.toUpperCase()}
              </motion.button>
            ))}
          </div>
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

        {/* Instagram optional */}
        <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIgOptional(!igOptional)}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                igOptional ? 'bg-primary' : 'bg-muted'
              }`}
            >
              {igOptional && <Check size={14} className="text-primary-foreground" />}
            </div>
            <span className="text-foreground text-sm font-bold">
              Habilitar publicação no Instagram (opcional)
            </span>
          </label>
          {igOptional && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="text-ui text-xs text-muted-foreground block mb-2">HASHTAGS</label>
              <input
                type="text"
                value={igHashtags}
                onChange={(e) => setIgHashtags(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                placeholder="#3bukchallenge #3bukrun"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Separe as hashtags por espaço</p>
            </motion.div>
          )}
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
