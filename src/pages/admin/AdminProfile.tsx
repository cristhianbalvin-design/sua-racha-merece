import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiUpdateUser, apiUploadAvatar } from '@/lib/mockApi';
import { Pencil, Save, X, Camera } from 'lucide-react';
import { toast } from 'sonner';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminProfile = () => {
  const { user, updateUserContext } = useAuth();
  
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
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

    await apiUpdateUser(user.id, { name, avatar: finalAvatar });
    updateUserContext({ name, avatar: finalAvatar });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCancel = () => {
    setEditing(false);
    setName(user.name);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">PERFIL DO ADMINISTRADOR</h1>
      
      <motion.div
        {...fadeIn}
        transition={spring}
        className="bg-card rounded-2xl p-6 card-shadow flex flex-col items-center text-center mt-8"
      >
        <div className="relative mb-6 group mt-4">
          <img
            src={avatarPreview || user.avatar}
            alt={name}
            className="w-32 h-32 rounded-full object-cover img-outline bg-muted"
          />
          {editing && (
            <>
              <input
                type="file"
                id="admin-avatar"
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
                htmlFor="admin-avatar"
                className="absolute inset-0 bg-background/50 rounded-full flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={32} className="text-foreground" />
              </label>
            </>
          )}
          {!editing && (
            <motion.button
              onClick={() => setEditing(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            >
              <Pencil size={18} />
            </motion.button>
          )}
        </div>

        {!editing ? (
          <div className="mb-4">
            <h2 className="font-bold italic text-3xl text-foreground mb-1">{name}</h2>
            <p className="text-ui text-xs text-muted-foreground mt-2 bg-primary/10 text-primary px-3 py-1 rounded-full inline-block">PERFIL ADMINISTRATIVO</p>
          </div>
        ) : (
          <div className="w-full text-left space-y-4 max-w-sm mx-auto mb-4">
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-2 cursor-pointer font-bold">NOME VISÍVEL</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
                placeholder="Seu nome"
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-muted text-foreground text-ui py-3 rounded-xl card-shadow flex items-center justify-center gap-2"
              >
                <X size={16} />
                CANCELAR
              </motion.button>
              <motion.button
                onClick={handleSave}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="flex-1 bg-primary text-primary-foreground text-ui py-3 rounded-xl btn-shadow flex items-center justify-center gap-2"
              >
                <Save size={16} />
                SALVAR
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success/20 text-success rounded-xl p-4 mt-6 text-sm font-bold text-center"
        >
          ✅ Perfil do administrador atualizado com sucesso!
        </motion.div>
      )}
    </div>
  );
};

export default AdminProfile;
