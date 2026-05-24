import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, FileText, Check } from 'lucide-react';
import { apiGetActiveTerms } from '@/lib/mockApi';
import type { TermsAndConditions } from '@/data/mockData';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  const [terms, setTerms] = useState<TermsAndConditions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchTerms = async () => {
        setLoading(true);
        try {
          const activeTerms = await apiGetActiveTerms();
          setTerms(activeTerms);
        } catch (error) {
          console.error('Erro ao buscar Termos e Condições:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchTerms();
    }
  }, [isOpen]);

  // Trap focus or handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAccept = () => {
    onAccept();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="relative w-full max-w-xl bg-card border border-border rounded-2xl overflow-hidden card-shadow flex flex-col max-h-[85vh] z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Termos e Condições</h2>
                  {terms && (
                    <p className="text-xs text-muted-foreground mt-0.5">Versão {terms.version}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 size={36} className="animate-spin text-primary mb-3" />
                  <p className="text-sm">Carregando termos e condições...</p>
                </div>
              ) : terms ? (
                <div 
                  className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed
                             prose-h3:text-foreground prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2
                             prose-p:mb-4 prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-2
                             prose-li:marker:text-primary/70"
                  dangerouslySetInnerHTML={{ __html: terms.content }}
                />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-sm">Nenhum termo ou condição ativo foi encontrado.</p>
                  <p className="text-xs mt-1">Por favor, entre em contato com o administrador.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-semibold cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={loading || !terms}
                onClick={handleAccept}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all text-sm font-bold btn-shadow flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <Check size={16} />
                Aceitar termos
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
