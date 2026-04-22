import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetSports, apiGetRegions, apiUpdateUser, apiUploadAvatar, apiGetParticipations } from '@/lib/mockApi';
import { Pencil, Save, X, Camera, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserProfile = () => {
  const { user, updateUserContext, logout } = useAuth();
  const navigate = useNavigate();
  const [sports, setSports] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [wonCount, setWonCount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    apiGetSports().then(setSports);
    apiGetRegions().then(setRegions);
  }, []);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [sport, setSport] = useState(user?.sport || '');
  const [saved, setSaved] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setCity(user.city);
      setCountry(user.country);
      setSport(user.sport);

      apiGetParticipations().then(parts => {
        const userParts = parts.filter(p => p.userId === user.id);
        // DB stores 'Concluído', 'Qualificado', 'Ganhador'
        const pCount = userParts.filter(p => ['Concluído', 'Qualificado', 'CONCLUÍDO', 'QUALIFICADO'].includes(p.participationStatus)).length;
        const wCount = userParts.filter(p => ['Ganhador', 'GANHADOR'].includes(p.participationStatus)).length;
        setParticipatedCount(pCount);
        setWonCount(wCount);
        // Flatten all media URLs — photo can be a single string or string[]
        const allMedia: string[] = userParts.flatMap(p => {
          if (!p.photo) return [];
          return Array.isArray(p.photo) ? p.photo : [p.photo];
        });
        setPhotos(allMedia);
      });
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    if (user) {
      setEditing(false);
      let finalAvatar = user.avatar;
      
      if (avatarFile) {
        toast.loading('Atualizando foto...', { id: 'avatar' });
        const uploadedUrl = await apiUploadAvatar(avatarFile, user.id);
        if (uploadedUrl) {
          finalAvatar = uploadedUrl;
          toast.success('Foto atualizada com sucesso!', { id: 'avatar' });
        } else {
          toast.error('Erro ao subir foto.', { id: 'avatar' });
        }
      }

      await apiUpdateUser(user.id, { name, city, country, sport, avatar: finalAvatar });
      // Update global context to sync immediately
      updateUserContext({
        name,
        city,
        country,
        sport,
        avatar: finalAvatar
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCancel = () => {
    setEditing(false);
    setName(user.name);
    setCity(user.city);
    setCountry(user.country);
    setSport(user.sport);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      {/* Profile header */}
      <motion.div
        {...fadeIn}
        transition={spring}
        className="flex flex-col items-center text-center mb-8"
      >
        <div className="relative mb-4 group">
          <img
            src={avatarPreview || user.avatar}
            alt={name}
            className="w-24 h-24 rounded-full object-cover img-outline bg-muted"
          />
          {editing && (
            <>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setAvatarFile(f);
                    setAvatarPreview(URL.createObjectURL(f));
                  }
                }}
              />
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-background/50 rounded-full flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={24} className="text-foreground" />
              </label>
            </>
          )}
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
            <p className="text-muted-foreground text-sm mb-1">{city}, {country}</p>
            {user.email && (
              <p className="text-muted-foreground/60 text-xs mb-2">{user.email}</p>
            )}
            <p className="text-secondary text-sm font-bold mb-3">{sport}</p>
            <PlanBadge plan={user.plan} />
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
                <label className="text-ui text-xs text-muted-foreground block mb-1.5">ESTADO</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all appearance-none"
                >
                  <option value="">Selecione</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
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
          <p className="text-2xl font-bold text-foreground">{participatedCount}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">PARTICIPADAS</p>
        </div>
        <div className="bg-card rounded-2xl p-4 card-shadow text-center">
          <p className="text-2xl font-bold text-accent">{wonCount}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">GANHAS</p>
        </div>
      </div>

      {/* Media gallery */}
      <h2 className="font-bold italic text-lg text-foreground mb-4">MINHA GALERIA</h2>
      {photos.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📸</span>
          <p className="text-muted-foreground text-sm">Nenhuma foto ou vídeo enviado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((url, i) => {
            const isVideo = /\.(mp4|mov|avi|webm|mkv|m4v)($|\?)/i.test(url);
            return (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02 }}
                transition={spring}
                className="aspect-square rounded-2xl overflow-hidden relative bg-muted"
              >
                {isVideo ? (
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Media ${i + 1}`}
                    className="w-full h-full object-cover img-outline"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Logout Button */}
      <div className="mt-12 flex justify-center">
        <motion.button
          onClick={handleLogout}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={spring}
          className="flex items-center gap-2 px-6 py-3 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-xl font-bold transition-colors"
        >
          <LogOut size={18} />
          SAIR DA CONTA
        </motion.button>
      </div>
    </div>
  );
};

export default UserProfile;
