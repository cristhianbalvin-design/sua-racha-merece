import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiAddHomePopup,
  apiDeleteHomePopup,
  apiGetHomePopups,
  apiUploadHomePopupImage,
} from '@/lib/mockApi';
import type { HomePopup } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const isActivePopup = (popup: HomePopup) => {
  const today = new Date().toISOString().split('T')[0];
  return popup.startDate <= today && popup.endDate >= today;
};

const AdminPopups = () => {
  const [popups, setPopups] = useState<HomePopup[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadPopups = async () => {
    setPopups(await apiGetHomePopups());
  };

  useEffect(() => {
    loadPopups();
  }, []);

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setImageFile(null);
    setPreview('');
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error('Selecione uma imagem para o popup.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast.error('A data final precisa ser posterior ao início.');
      return;
    }

    setSubmitting(true);
    try {
      const imageUrl = await apiUploadHomePopupImage(imageFile);
      if (!imageUrl) return;

      const created = await apiAddHomePopup({
        name,
        imageUrl,
        targetUrl: '',
        startDate,
        endDate,
      });

      if (created) {
        toast.success('Popup publicado!');
        resetForm();
        await loadPopups();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (popup: HomePopup) => {
    if (!window.confirm(`Excluir o popup "${popup.name}"?`)) return;
    await apiDeleteHomePopup(popup.id);
    setPopups(prev => prev.filter(item => item.id !== popup.id));
    toast.success('Popup excluído.');
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('URL copiada.');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold italic text-2xl text-foreground">POPUPS DO HOME</h1>
      </div>

      <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
        <form onSubmit={handleCreate} className="bg-card rounded-2xl p-6 card-shadow space-y-4">
          <div>
            <h2 className="font-bold italic text-lg text-foreground">PUBLICAR POPUP</h2>
            <p className="text-sm text-muted-foreground mt-1">A imagem aparecerá no home durante o período ativo.</p>
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">NOME DO POPUP</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all"
              placeholder="Ex: Campanha Maio 3BUK"
              required
            />
          </div>

          <div>
            <label className="text-ui text-xs text-muted-foreground block mb-2">IMAGEM DO POPUP</label>
            <p className="text-xs text-muted-foreground mb-2">Formato recomendado: horizontal, 4:3.</p>
            <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-muted/40 hover:bg-muted/60 transition-colors p-4 max-w-xs">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              {preview ? (
                <img src={preview} alt="Preview do popup" className="w-full aspect-[4/3] object-cover rounded-lg bg-background" />
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImagePlus size={32} />
                  <span className="text-sm font-bold">Enviar imagem</span>
                </div>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-2">ATIVO DESDE</label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate('');
                }}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="text-ui text-xs text-muted-foreground block mb-2">ATIVO ATÉ</label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring outline-none transition-all"
                required
              />
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={!submitting ? { scale: 1.03 } : {}}
            whileTap={!submitting ? { scale: 0.97 } : {}}
            transition={spring}
            className={`w-full text-primary-foreground text-ui py-3 rounded-xl btn-shadow ${submitting ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:btn-shadow-hover'}`}
          >
            {submitting ? 'PUBLICANDO...' : 'PUBLICAR POPUP'}
          </motion.button>
        </form>

        <div className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold italic text-lg text-foreground">POPUPS PUBLICADOS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">POPUP</th>
                  <th className="text-left px-4 py-3 text-ui text-xs text-muted-foreground">PERÍODO</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {popups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum popup publicado.
                    </td>
                  </tr>
                ) : (
                  popups.map((popup) => (
                    <tr key={popup.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={popup.imageUrl} alt={popup.name} className="w-14 aspect-[4/3] object-cover rounded-md bg-muted" />
                          <div>
                            <p className="font-bold text-foreground">{popup.name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActivePopup(popup) ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {isActivePopup(popup) ? 'ATIVO' : 'INATIVO'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{popup.startDate} até {popup.endDate}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(popup)}
                          title="Excluir popup"
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPopups;
