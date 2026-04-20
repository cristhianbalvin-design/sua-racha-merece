import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { Camera } from 'lucide-react';
import { OnboardingStepper } from '@/components/OnboardingStepper';
import { useAuth } from '@/contexts/AuthContext';
import { apiUpdateUser, apiUploadAvatar, apiGetSports, apiGetRegions } from '@/lib/mockApi';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, updateUserContext } = useAuth();
  
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [regionsList, setRegionsList] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [sport, setSport] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiGetSports().then(setSportsList);
    apiGetRegions().then(setRegionsList);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/dashboard');
      return;
    }

    setIsSubmitting(true);
    let finalAvatar = user.avatar;

    try {
      if (avatarFile) {
        toast.loading('Fazendo upload da foto...', { id: 'onboarding-avatar' });
        const uploadedUrl = await apiUploadAvatar(avatarFile, user.id);
        if (uploadedUrl) {
          finalAvatar = uploadedUrl;
          toast.success('Foto enviada com sucesso!', { id: 'onboarding-avatar' });
        } else {
          toast.error('Erro ao enviar foto.', { id: 'onboarding-avatar' });
        }
      }

      await apiUpdateUser(user.id, { name, city, country, sport, phone, gender, avatar: finalAvatar });
      
      // Update context securely, which forces React to re-render the Header and all views
      updateUserContext({
        name,
        city,
        country,
        sport,
        ...(phone && { phone }),
        ...(gender && { gender }),
        ...(finalAvatar && { avatar: finalAvatar })
      });
      
      toast.success('¡Perfil completo!');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al guardar tu perfil.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <OnboardingStepper currentStep={3} />
        <div className="text-center mb-8">
          <Logo size="md" />
          <h1 className="font-bold italic text-2xl text-foreground mt-4 uppercase">COMPLETA TU PERFIL</h1>
          <p className="text-muted-foreground mt-2">¡Queremos conocerte mejor!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar upload */}
          <div className="flex justify-center mb-6 relative group">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover img-outline" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
              )}
              <input
                type="file"
                id="avatar-onboarding"
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
                htmlFor="avatar-onboarding"
                className="absolute inset-0 bg-background/50 rounded-full flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={24} className="text-foreground" />
              </label>
            </div>
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">NOMBRE COMPLETO</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all"
              placeholder="Su nombre completo"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">CIUDAD</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all"
              placeholder="São Paulo"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">ESTADO</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all appearance-none"
              required
            >
              <option value="">Seleccione su estado</option>
              {regionsList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">DEPORTE FAVORITO</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all appearance-none"
              required
            >
              <option value="">Seleccionar</option>
              {sportsList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">NÚMERO DE CELULAR</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all"
              placeholder="Su número de celular"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2 uppercase">SEXO</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all appearance-none"
              required
            >
              <option value="">Seleccionar</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={!isSubmitting ? { scale: 1.03 } : {}}
            whileTap={!isSubmitting ? { scale: 0.97 } : {}}
            transition={spring}
            className={`w-full text-primary-foreground text-ui py-3 rounded-xl font-bold btn-shadow transition-shadow ${isSubmitting ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:btn-shadow-hover'}`}
          >
            {isSubmitting ? 'GUARDANDO...' : 'GUARDAR PERFIL'}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
