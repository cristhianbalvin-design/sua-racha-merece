import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Plus, Trash2, Edit, X } from 'lucide-react';
import { apiGetPhotographers, apiAddPhotographer, apiUpdatePhotographer, apiDeletePhotographer, apiUploadPhotographerPhoto, Photographer } from '@/lib/mockApi';
import { SHOW_FACE_SEARCH } from '@/config/features';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const dateObj = new Date(dateStr);
  return dateObj.toLocaleDateString('pt-BR');
};

const AdminPhotographers = () => {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    if (SHOW_FACE_SEARCH) fetchPhotographers();
  }, []);

  const fetchPhotographers = async () => {
    try {
      const data = await apiGetPhotographers();
      setPhotographers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setPName('');
    setPEmail('');
    setPPhone('');
    setPhotoFile(null);
    setPhotoPreview('');
    setFormSubmitted(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!pName.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    setIsSubmitting(true);

    try {
      let photoUrl = photoPreview || undefined;
      if (photoFile) {
        photoUrl = await apiUploadPhotographerPhoto(photoFile) || undefined;
        if (!photoUrl) return;
      }
      if (editingId) {
        await apiUpdatePhotographer(editingId, { 
          name: pName.trim(), 
          email: pEmail.trim(), 
          phone: pPhone.trim(),
          photo_url: photoUrl || '',
        });
        toast.success('Fotógrafo atualizado com sucesso!');
      } else {
        await apiAddPhotographer(pName.trim(), pEmail.trim(), pPhone.trim(), photoUrl);
        toast.success('Fotógrafo adicionado com sucesso!');
      }

      await fetchPhotographers();
      setFormSubmitted(true);
      
      setTimeout(() => {
        setShowCreate(false);
        resetForm();
      }, 1500);

    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (p: Photographer) => {
    setEditingId(p.id);
    setPName(p.name);
    setPEmail(p.email || '');
    setPPhone(p.phone || '');
    setPhotoFile(null);
    setPhotoPreview(p.photo_url || '');
    setFormSubmitted(false);
    setShowCreate(true);
  };

  if (!SHOW_FACE_SEARCH) {
    return <Navigate to="/admin/dashboard" />;
  }

  const handleDeleteClick = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o fotógrafo "${name}"?\n\nAs fotos já atribuídas a este fotógrafo não serão apagadas, apenas ficarão sem fotógrafo associado.`)) {
      try {
        await apiDeletePhotographer(id);
        toast.success('Fotógrafo removido com sucesso');
        setPhotographers(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        console.error('Error deleting photographer:', err);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold italic text-2xl text-foreground">FOTÓGRAFOS</h1>
          <p className="text-muted-foreground text-sm">Gerencie os fotógrafos disponíveis para as campanhas.</p>
        </div>
        <motion.button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="bg-primary text-primary-foreground text-ui text-xs px-5 py-2.5 rounded-xl btn-shadow flex items-center gap-2"
        >
          <Plus size={16} />
          NOVO FOTÓGRAFO
        </motion.button>
      </div>

      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">FOTO</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">NOME</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">EMAIL</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">TELEFONE</th>
                <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">DATA CADASTRO</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {photographers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum fotógrafo cadastrado.
                  </td>
                </tr>
              ) : (
                photographers.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/25" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Camera size={18} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground font-bold">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(p)}
                          title="Editar fotógrafo"
                          className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p.id, p.name)}
                          title="Excluir fotógrafo"
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl p-6 card-shadow max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              {!formSubmitted ? (
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <h3 className="font-bold italic text-lg text-foreground mb-4">
                    {editingId ? 'ATUALIZAR FOTÓGRAFO' : 'NOVO FOTÓGRAFO'}
                  </h3>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">FOTO DE PERFIL (OPCIONAL)</label>
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-2 ring-primary/25">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Prévia do fotógrafo" className="h-full w-full object-cover" />
                        ) : (
                          <Camera size={24} />
                        )}
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                            className="absolute right-0 top-0 rounded-full bg-background/85 p-1 text-destructive"
                            aria-label="Remover foto"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <label className="cursor-pointer rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted/80">
                        ESCOLHER IMAGEM
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              setPhotoFile(file);
                              setPhotoPreview(URL.createObjectURL(file));
                            }
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">NOME *</label>
                    <input 
                      type="text" 
                      value={pName} 
                      onChange={(e) => setPName(e.target.value)} 
                      className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" 
                      placeholder="Nome do fotógrafo" 
                      required 
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">EMAIL (OPCIONAL)</label>
                    <input 
                      type="email" 
                      value={pEmail} 
                      onChange={(e) => setPEmail(e.target.value)} 
                      className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" 
                      placeholder="contato@exemplo.com" 
                    />
                  </div>

                  <div>
                    <label className="text-ui text-xs text-muted-foreground block mb-2">TELEFONE (OPCIONAL)</label>
                    <input 
                      type="text" 
                      value={pPhone} 
                      onChange={(e) => setPPhone(e.target.value)} 
                      className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all" 
                      placeholder="+34 600 000 000" 
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      type="button"
                      onClick={() => { setShowCreate(false); resetForm(); }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-muted text-foreground text-ui text-xs py-3 rounded-xl"
                      disabled={isSubmitting}
                    >
                      CANCELAR
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isSubmitting || !pName.trim()}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex-1 bg-primary text-primary-foreground text-ui text-xs py-3 rounded-xl btn-shadow disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {isSubmitting ? 'SALVANDO...' : 'SALVAR'}
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <span className="text-5xl block mb-3">✅</span>
                  <h3 className="font-bold italic text-lg text-foreground mb-2">Fotógrafo Salvo!</h3>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPhotographers;
