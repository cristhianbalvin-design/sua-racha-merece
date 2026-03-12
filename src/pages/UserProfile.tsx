import { useState } from 'react';
import { motion } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { currentUser, sports } from '@/data/mockData';
import { Pencil, Save, X } from 'lucide-react';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserProfile = () => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [city, setCity] = useState(currentUser.city);
  const [country, setCountry] = useState(currentUser.country);
  const [sport, setSport] = useState(currentUser.sport);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCancel = () => {
    setEditing(false);
    setName(currentUser.name);
    setCity(currentUser.city);
    setCountry(currentUser.country);
    setSport(currentUser.sport);
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      {/* Profile header */}
      <motion.div
        {...fadeIn}
        transition={spring}
        className="flex flex-col items-center text-center mb-8"
      >
        <div className="relative mb-4">
          <img
            src={currentUser.avatar}
            alt={name}
            className="w-24 h-24 rounded-full object-cover img-outline"
          />
          {!editing && (
            <motion.button
              onClick={() => setEditing(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center"
            >
              <Pencil size={14} />
            </motion.button>
          )}
        </div>

        {!editing ? (
          <>
            <h1 className="font-bold italic text-2xl text-foreground mb-1">{name}</h1>
            <p className="text-muted-foreground text-sm mb-2">{city}, {country}</p>
            <p className="text-secondary text-sm font-bold mb-3">{sport}</p>
            <PlanBadge plan={currentUser.plan} />
          </>
        ) : (
          <div className="w-full text-left space-y-3 mt-2">
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-1.5">NOME COMPLETO</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ui text-xs text-muted-foreground block mb-1.5">CIDADE</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-ui text-xs text-muted-foreground block mb-1.5">PAÍS</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-1.5">ESPORTE FAVORITO</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
              >
                {sports.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-muted text-foreground text-ui text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5"
              >
                <X size={14} />
                CANCELAR
              </motion.button>
              <motion.button
                onClick={handleSave}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-2.5 rounded-xl btn-shadow flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                SALVAR
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Saved toast */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success/20 text-success rounded-xl p-3 mb-6 text-sm font-bold text-center"
        >
          ✅ Perfil atualizado com sucesso!
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-4 card-shadow text-center">
          <p className="text-2xl font-bold text-foreground">{currentUser.campaignsParticipated}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">PARTICIPADAS</p>
        </div>
        <div className="bg-card rounded-2xl p-4 card-shadow text-center">
          <p className="text-2xl font-bold text-accent">{currentUser.campaignsWon}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">GANHAS</p>
        </div>
      </div>

      {/* Photo gallery */}
      <h2 className="font-bold italic text-lg text-foreground mb-4">MINHAS FOTOS</h2>
      {currentUser.photos.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📸</span>
          <p className="text-muted-foreground text-sm">Nenhuma foto enviada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {currentUser.photos.map((photo, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              transition={spring}
              className="aspect-square rounded-2xl overflow-hidden"
            >
              <img
                src={photo}
                alt={`Foto ${i + 1}`}
                className="w-full h-full object-cover img-outline"
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
