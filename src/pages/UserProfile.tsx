import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetSports, apiGetRegions, apiUpdateUser, apiUploadAvatar, apiGetParticipations, apiGetAthleteNumber } from '@/lib/mockApi';
import { Pencil, Save, X, Camera, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

import { SportProfileForm } from '@/components/profile/SportProfileForm';
import { SocialLinksForm } from '@/components/profile/SocialLinksForm';
import { UserParticipationHistory } from '@/components/profile/UserParticipationHistory';
import { Flame, Share2, Trophy, Image as ImageIcon } from 'lucide-react';

type ProfileTab = 'esportivo' | 'sociais' | 'historico' | 'galeria';

const UserProfile = () => {
  const { user, isAdmin, updateUserContext, logout } = useAuth();
  const navigate = useNavigate();
  const [sports, setSports] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [participatedCount, setParticipatedCount] = useState(0);
  const [wonCount, setWonCount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [athleteNumber, setAthleteNumber] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('esportivo');

  useEffect(() => {
    apiGetSports().then(setSports);
    apiGetRegions().then(setRegions);
  }, []);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [sport, setSport] = useState(user?.sport || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      apiGetAthleteNumber(user.id).then(setAthleteNumber);
      setName(user.name);
      setCity(user.city);
      setCountry(user.country);
      setSport(user.sport);
      setBirthDate(user.birthDate || '');

      apiGetParticipations().then((parts) => {
        const userParts = parts.filter((p) => p.userId === user.id);
        setParticipatedCount(
          userParts.filter((p) =>
            ['Concluído', 'Qualificado', 'CONCLUÍDO', 'QUALIFICADO'].includes(p.participationStatus)
          ).length
        );
        setWonCount(
          userParts.filter((p) =>
            ['Ganhador', 'GANHADOR'].includes(p.participationStatus)
          ).length
        );
        setPhotos(
          userParts.flatMap((p) => {
            if (!p.photo) return [];
            return Array.isArray(p.photo) ? p.photo : [p.photo];
          })
        );
      });
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setEditing(false);
    let finalAvatar = user.avatar;

    if (avatarFile) {
      toast.loading('Atualizando foto...', { id: 'avatar' });
      const uploadedUrl = await apiUploadAvatar(avatarFile, user.id);
      if (uploadedUrl) {
        finalAvatar = uploadedUrl;
        toast.success('Foto atualizada!', { id: 'avatar' });
      } else {
        toast.error('Erro ao subir foto.', { id: 'avatar' });
      }
    }

    await apiUpdateUser(user.id, { name, city, country, sport, birthDate, avatar: finalAvatar });
    updateUserContext({ name, city, country, sport, ...(birthDate !== undefined && { birthDate }), avatar: finalAvatar });
    setAvatarFile(null);
    setAvatarPreview(null);
    toast.success('Perfil atualizado!');
  };

  const handleCancel = () => {
    setEditing(false);
    setName(user.name);
    setCity(user.city);
    setCountry(user.country);
    setSport(user.sport);
    setBirthDate(user.birthDate || '');
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="px-4 md:px-8 py-4 max-w-2xl mx-auto">
      {athleteNumber !== null && (
        <div className="mb-4 text-center">
          <span className="inline-flex rounded-full bg-primary/15 px-4 py-1.5 text-sm font-bold text-primary">
            Atleta #{athleteNumber}
          </span>
        </div>
      )}
      {/* ── Edit form ── */}
      <motion.div {...fadeIn} transition={spring} className="mb-6">
        {!editing ? (
          <motion.button
            onClick={() => setEditing(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={spring}
            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground text-ui text-sm font-bold py-3 rounded-xl transition-colors"
          >
            <Pencil size={14} />
            EDITAR INFORMAÇÕES PESSOAIS
          </motion.button>
        ) : (
          <div className="bg-card rounded-2xl card-shadow p-5 space-y-4">
            {/* Avatar upload */}
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="relative group shrink-0">
                <img
                  src={avatarPreview || user.avatar}
                  alt={name}
                  className="w-16 h-16 rounded-full object-cover img-outline bg-muted"
                />
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
                  className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={20} className="text-foreground" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
            </div>

            {/* Fields */}
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
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-1.5">DATA DE NASCIMENTO</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-muted text-foreground text-ui text-xs py-3 rounded-xl flex items-center justify-center gap-1.5"
              >
                <X size={14} />
                CANCELAR
              </motion.button>
              <motion.button
                onClick={handleSave}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-3 rounded-xl btn-shadow flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                SALVAR
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Stats (Clickable to open Meu Histórico) ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.button
          type="button"
          onClick={() => setActiveTab('historico')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-card rounded-2xl p-4 card-shadow text-center transition-all hover:ring-2 hover:ring-primary/40 text-left w-full cursor-pointer"
        >
          <p className="text-2xl font-bold text-foreground">{participatedCount}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground text-ui font-bold">PARTICIPADAS</span>
            <span className="text-[10px] text-primary font-bold">Ver histórico →</span>
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveTab('historico')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-card rounded-2xl p-4 card-shadow text-center transition-all hover:ring-2 hover:ring-accent/40 text-left w-full cursor-pointer"
        >
          <p className="text-2xl font-bold text-accent">{wonCount}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground text-ui font-bold">GANHAS</span>
            <span className="text-[10px] text-accent font-bold">Ver prêmios →</span>
          </div>
        </motion.button>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex gap-2 p-1.5 bg-muted/60 rounded-2xl mb-6 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('esportivo')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'esportivo'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Flame size={14} />
          ESPORTIVO
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sociais')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'sociais'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Share2 size={14} />
          REDES
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'historico'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Trophy size={14} />
          3BUK ({participatedCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('galeria')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'galeria'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ImageIcon size={14} />
          GALERIA ({photos.length})
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="mb-8">
        {activeTab === 'esportivo' && (
          <SportProfileForm userId={user.id} />
        )}

        {activeTab === 'sociais' && (
          <SocialLinksForm userId={user.id} />
        )}

        {activeTab === 'historico' && (
          <UserParticipationHistory userId={user.id} />
        )}

        {activeTab === 'galeria' && (
          <div>
            <h2 className="font-bold italic text-lg text-foreground mb-4">MINHA GALERIA</h2>
            {photos.length === 0 ? (
              <div className="bg-card rounded-2xl card-shadow text-center py-12">
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
          </div>
        )}
      </div>

      {/* ── Logout ── */}
      <div className="mt-12 flex flex-col items-center gap-4">
        {isAdmin && (
          <motion.button
            onClick={() => navigate('/admin/usuarios')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-colors shadow-lg"
          >
            PANEL DE ADMINISTRACIÓN
          </motion.button>
        )}
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
