import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { apiGetActiveHomePopup } from '@/lib/mockApi';
import type { HomePopup } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserPhotos3buk = () => {
  const [popup, setPopup] = useState<HomePopup | null>(null);

  useEffect(() => {
    apiGetActiveHomePopup().then(setPopup);
  }, []);

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-bold italic text-2xl text-foreground">FOTOGRAFIAS 3BUK</h1>
        <p className="text-muted-foreground mt-2">Imagens ativas da 3BUK para atletas participantes.</p>
      </div>

      {!popup ? (
        <div className="bg-card/40 border border-dashed border-border rounded-2xl py-16 px-4 text-center">
          <ImageIcon size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="font-bold italic text-lg text-foreground mb-2">Nenhuma fotografia ativa.</h2>
          <p className="text-sm text-muted-foreground">Quando houver um popup ativo, ele aparecerá aqui.</p>
        </div>
      ) : (
        <motion.a
          href={popup.targetUrl}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4 }}
          transition={spring}
          className="block bg-card rounded-2xl border border-border card-shadow overflow-hidden hover:card-shadow-hover transition-shadow"
        >
          <img
            src={popup.imageUrl}
            alt={popup.name}
            className="w-full aspect-[5/2] object-cover bg-muted"
          />
          <div className="p-5">
            <p className="font-bold italic text-xl text-foreground">{popup.name}</p>
            <p className="text-sm text-muted-foreground mt-1">Clique na imagem para acessar.</p>
          </div>
        </motion.a>
      )}
    </div>
  );
};

export default UserPhotos3buk;
