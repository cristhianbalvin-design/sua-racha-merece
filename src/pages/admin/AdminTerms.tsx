import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Eye, History, Loader2, AlertCircle, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { apiGetActiveTerms, apiGetTermsHistory, apiSaveTerms, apiUpdateTermsContent, apiActivateTermsVersion } from '@/lib/mockApi';
import type { TermsAndConditions } from '@/data/mockData';

// Import ReactQuill and its snow stylesheet
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Register a custom 'hr' format in Quill safely
try {
  const BlockEmbed = Quill.import('blots/block/embed');
  class HorizontalRuleBlot extends BlockEmbed {
    static create() {
      return document.createElement('hr');
    }
  }
  HorizontalRuleBlot.blotName = 'hr';
  HorizontalRuleBlot.tagName = 'hr';
  Quill.register(HorizontalRuleBlot);
} catch (e) {
  console.warn('HorizontalRuleBlot already registered:', e);
}

// Custom modules configuration for Quill toolbar
const modules = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['hr'], // Custom horizontal line button
      ['clean']
    ],
    handlers: {
      'hr': function(this: any) {
        const range = this.quill.getSelection();
        if (range) {
          this.quill.insertEmbed(range.index, 'hr', 'null');
          // Move cursor after the horizontal rule
          this.quill.setSelection(range.index + 1);
        }
      }
    }
  }
};

const formats = [
  'header',
  'bold', 'italic', 'underline',
  'list', 'bullet',
  'align',
  'link',
  'hr'
];

const AdminTerms = () => {
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');
  const [content, setContent] = useState('');
  const [activeTerms, setActiveTerms] = useState<TermsAndConditions | null>(null);
  const [editingTerms, setEditingTerms] = useState<TermsAndConditions | null>(null);
  const [history, setHistory] = useState<TermsAndConditions[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const active = await apiGetActiveTerms();
      setActiveTerms(active);
      
      // If we are not currently editing a specific version, load the active one
      if (!editingTerms) {
        if (active) {
          setContent(active.content);
        }
      } else {
        // Refresh the currently editing version from history to ensure sync
        const currentHist = await apiGetTermsHistory();
        const updatedEditing = currentHist.find(h => h.id === editingTerms.id);
        if (updatedEditing) {
          setEditingTerms(updatedEditing);
          setContent(updatedEditing.content);
        }
      }
      
      const hist = await apiGetTermsHistory();
      setHistory(hist);
    } catch (err: any) {
      setError('Erro ao carregar dados: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set custom icon and tooltip for HR button when editor renders
  useEffect(() => {
    if (activeTab === 'edit' && !loading) {
      const timer = setTimeout(() => {
        const hrButton = document.querySelector('.ql-editor-dark .ql-hr');
        if (hrButton) {
          hrButton.innerHTML = `<svg viewBox="0 0 18 18" class="w-4 h-4">
            <line class="ql-stroke" x1="2" y1="9" x2="16" y2="9" stroke-width="2" stroke-linecap="round"></line>
            <line class="ql-stroke" x1="2" y1="5" x2="6" y2="5" stroke-width="2" stroke-linecap="round"></line>
            <line class="ql-stroke" x1="12" y1="13" x2="16" y2="13" stroke-width="2" stroke-linecap="round"></line>
          </svg>`;
          hrButton.setAttribute('title', 'Inserir Linha Horizontal');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loading]);

  const handleSave = async () => {
    const trimmed = content.trim();
    // Quill empty content is often represented as '<p><br></p>'
    if (!trimmed || trimmed === '<p><br></p>') {
      setError('O conteúdo dos Termos e Condições não pode estar vazio.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (editingTerms) {
        // Edit existing version
        const saved = await apiUpdateTermsContent(editingTerms.id, trimmed);
        if (saved) {
          if (editingTerms.isActive) {
            setActiveTerms(saved);
          }
          setEditingTerms(saved);
          // Refresh list
          const hist = await apiGetTermsHistory();
          setHistory(hist);
        }
      } else {
        // Create new version
        const saved = await apiSaveTerms(trimmed);
        if (saved) {
          setActiveTerms(saved);
          // Refresh list
          const hist = await apiGetTermsHistory();
          setHistory(hist);
        }
      }
    } catch (err: any) {
      setError('Erro ao salvar termos: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleActivateVersion = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const success = await apiActivateTermsVersion(id);
      if (success) {
        // Reset editing terms if we activated it, or reload
        setEditingTerms(null);
        await loadData();
      }
    } catch (err: any) {
      setError('Erro ao ativar versão: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* CSS overrides for custom dark themed Quill editor */}
      <style>{`
        .ql-editor-dark .ql-toolbar.ql-snow {
          background-color: hsl(var(--card));
          border-color: hsl(var(--border)) !important;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          padding: 8px 12px;
        }
        .ql-editor-dark .ql-container.ql-snow {
          background-color: hsl(var(--background));
          border-color: hsl(var(--border)) !important;
          border-bottom-left-radius: 0.75rem;
          border-bottom-right-radius: 0.75rem;
          font-family: inherit;
          font-size: 0.875rem;
          height: 380px !important;
          overflow: hidden;
        }
        .ql-editor-dark .ql-editor {
          color: hsl(var(--foreground));
          padding: 16px;
          height: 100%;
          overflow-y: auto;
        }
        .ql-editor-dark .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground)) !important;
          font-style: normal;
          left: 16px;
        }
        .ql-editor-dark .ql-snow .ql-stroke {
          stroke: hsl(var(--foreground)) !important;
        }
        .ql-editor-dark .ql-snow .ql-fill {
          fill: hsl(var(--foreground)) !important;
        }
        .ql-editor-dark .ql-snow .ql-picker {
          color: hsl(var(--foreground)) !important;
        }
        .ql-editor-dark .ql-snow .ql-picker-options {
          background-color: hsl(var(--card)) !important;
          border-color: hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
          border-radius: 8px;
        }
        .ql-editor-dark .ql-snow .ql-picker-item:hover,
        .ql-editor-dark .ql-snow .ql-picker-item.ql-selected {
          color: hsl(var(--primary)) !important;
        }
        .ql-editor-dark .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ql-editor-dark .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--primary)) !important;
        }
        .ql-editor-dark .ql-snow.ql-toolbar button:hover .ql-fill,
        .ql-editor-dark .ql-snow.ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--primary)) !important;
        }
        .ql-editor-dark .ql-snow.ql-toolbar .ql-picker-label:hover,
        .ql-editor-dark .ql-snow.ql-toolbar .ql-picker-label.ql-active {
          color: hsl(var(--primary)) !important;
        }
        .ql-editor-dark .ql-snow .ql-stroke.ql-thin {
          stroke-width: 1 !important;
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-bold italic text-2xl text-foreground flex items-center gap-2">
            TERMOS E CONDIÇÕES
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o contrato de Termos de Uso e Política de Privacidade exibido no registro.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-card text-foreground card-shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye size={14} />
            Editor & Preview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-card text-foreground card-shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History size={14} />
            Histórico ({history.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card border border-border rounded-2xl card-shadow">
          <Loader2 size={36} className="animate-spin text-primary mb-3" />
          <p className="text-sm">Carregando termos e condições do servidor...</p>
        </div>
      ) : activeTab === 'edit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Column */}
          <div className="bg-card rounded-2xl card-shadow border border-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" />
                {editingTerms ? (
                  <>
                    EDITANDO VERSIÓN: <span className="text-primary font-extrabold">v{editingTerms.version}</span>
                    {editingTerms.isActive ? (
                      <span className="ml-2 text-[9px] uppercase font-bold bg-primary/20 px-1.5 py-0.5 rounded text-primary">Activa</span>
                    ) : (
                      <span className="ml-2 text-[9px] uppercase font-bold bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">Historial</span>
                    )}
                  </>
                ) : (
                  "CONTEÚDO (EDITOR VISUAL)"
                )}
              </span>
              <div className="flex items-center gap-3">
                {editingTerms && (
                  <button
                    onClick={() => {
                      setEditingTerms(null);
                      setContent(activeTerms ? activeTerms.content : '');
                    }}
                    className="text-xs text-destructive hover:underline cursor-pointer font-bold"
                  >
                    Cancelar edição
                  </button>
                )}
                {activeTerms && (
                  <span className="text-xs text-muted-foreground">
                    Versão Atual: <strong className="text-primary">v{activeTerms.version}</strong>
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4 flex-1 ql-editor-dark">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                placeholder="Insira o texto dos Termos e Condições aqui..."
              />
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end">
              {editingTerms && !editingTerms.isActive && (
                <button
                  type="button"
                  onClick={() => handleActivateVersion(editingTerms.id)}
                  disabled={saving}
                  className="mr-3 bg-card border border-border text-foreground hover:bg-muted/80 transform hover:scale-105 active:scale-95 transition-all duration-200 text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl card-shadow cursor-pointer disabled:pointer-events-none"
                >
                  ATIVAR ESTA VERSÃO
                </button>
              )}
              
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:opacity-90 transform hover:scale-105 active:scale-95 transition-all duration-200 text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl btn-shadow flex items-center gap-2 cursor-pointer disabled:pointer-events-none"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    SALVANDO...
                  </>
                ) : editingTerms ? (
                  <>
                    <Save size={16} />
                    SALVAR ALTERAÇÕES
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    SALVAR E PUBLICAR
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="bg-card rounded-2xl card-shadow border border-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/10">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Eye size={12} />
                AVANCE REAL (PREVIEW)
              </span>
            </div>

            <div className="p-6 flex-1 overflow-y-auto max-h-[520px]">
              {content.trim() && content !== '<p><br></p>' ? (
                <div 
                  className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed
                             prose-h3:text-foreground prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2
                             prose-p:mb-4 prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-2
                             prose-li:marker:text-primary/70"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="text-sm italic">Nenhum conteúdo para visualizar.</p>
                  <p className="text-xs mt-1">Escreva algo no editor à esquerda para ver a pré-visualização.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-card rounded-2xl card-shadow border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/10">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <History size={12} />
              HISTÓRICO DE VERSÕES
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma versão anterior registrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4">Versão</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Data de Criação</th>
                    <th className="px-6 py-4">Conteúdo (Resumo)</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">v{item.version}</td>
                      <td className="px-6 py-4">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary-foreground animate-pulse">
                            <CheckCircle2 size={12} /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            Histórico
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                        {item.content.replace(/<[^>]*>/g, '').substring(0, 80)}...
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditingTerms(item);
                            setContent(item.content);
                            setActiveTab('edit');
                          }}
                          className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary-foreground text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          Editar
                        </button>
                        {!item.isActive && (
                          <button
                            onClick={() => handleActivateVersion(item.id)}
                            className="px-3 py-1.5 bg-card hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 border border-border"
                          >
                            Ativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminTerms;
