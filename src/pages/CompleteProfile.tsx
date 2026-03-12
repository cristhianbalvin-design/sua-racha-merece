import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { sports } from '@/data/mockData';
import { Camera } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [sport, setSport] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size="md" />
          <h1 className="font-bold italic text-2xl text-foreground mt-4">COMPLETE SEU PERFIL</h1>
          <p className="text-muted-foreground mt-2">Queremos te conhecer melhor!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar upload */}
          <div className="flex justify-center mb-6">
            <button
              type="button"
              className="w-24 h-24 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Camera size={32} className="text-muted-foreground" />
            </button>
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">NOME COMPLETO</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">CIDADE</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="São Paulo"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">PAÍS</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              placeholder="Brasil"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">ESPORTE FAVORITO</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
              required
            >
              <option value="">Selecione</option>
              {sports.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="w-full bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow hover:btn-shadow-hover transition-shadow"
          >
            SALVAR PERFIL
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
