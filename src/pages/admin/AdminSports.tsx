import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { apiGetSports, apiAddSport, apiRemoveSport } from '@/lib/mockApi';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminSports = () => {
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [newSport, setNewSport] = useState('');

  useEffect(() => {
    apiGetSports().then(setSportsList);
  }, []);

  const handleAdd = async () => {
    const trimmed = newSport.trim();
    if (trimmed && !sportsList.includes(trimmed)) {
      await apiAddSport(trimmed);
      setSportsList(await apiGetSports());
      setNewSport('');
    }
  };

  const handleRemove = async (sport: string) => {
    await apiRemoveSport(sport);
    setSportsList(await apiGetSports());
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">ESPORTES</h1>

      {/* Add new sport */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={newSport}
          onChange={(e) => setNewSport(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
          placeholder="Nome do esporte"
        />
        <motion.button
          onClick={handleAdd}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="bg-primary text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl btn-shadow flex items-center gap-2"
        >
          <Plus size={16} />
          ADICIONAR
        </motion.button>
      </div>

      {/* Sports list */}
      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        <div className="divide-y divide-border">
          {sportsList.map((sport, i) => (
            <motion.div
              key={sport}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-foreground text-sm font-bold">{sport}</span>
              <motion.button
                onClick={() => handleRemove(sport)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={16} />
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSports;
