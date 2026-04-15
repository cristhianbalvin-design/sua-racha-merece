import React, { useState, useEffect } from 'react';

import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { apiGetSports, apiAddSport, apiRemoveSport } from '@/lib/mockApi';


const AdminSports = () => {
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [newSport, setNewSport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const data = await apiGetSports();
    setSportsList(data);
  };

  useEffect(() => { refresh(); }, []);

  const handleAdd = async () => {
    const trimmed = newSport.trim();
    if (!trimmed) return;

    // Case-insensitive duplicate check
    const exists = sportsList.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setError(`"${trimmed}" já existe na lista.`);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await apiAddSport(trimmed);
      await refresh();
      setNewSport('');
    } catch (e: any) {
      setError('Erro ao adicionar: ' + (e?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (sport: string) => {
    await apiRemoveSport(sport);
    await refresh();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">ESPORTES</h1>

      {/* Add new sport */}
      <div className="flex gap-3 mb-2">
        <input
          type="text"
          value={newSport}
          onChange={(e) => { setNewSport(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-input text-foreground rounded-lg px-4 py-3 input-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none transition-all"
          placeholder="Nome do esporte"
          disabled={loading}
        />
        <button
          onClick={handleAdd}
          disabled={loading}
          className="bg-primary hover:opacity-90 transform hover:scale-105 active:scale-95 transition-all duration-200 text-primary-foreground text-ui text-xs px-5 py-3 rounded-xl btn-shadow flex items-center gap-2 cursor-pointer disabled:pointer-events-none"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          ADICIONAR
        </button>
      </div>

      {/* Error message */}
      {error ? (
        <div className="flex items-center gap-2 text-destructive text-xs mb-4 px-1 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={12} /> {error}
        </div>
      ) : null}

      {/* Sports list */}
      <div className="bg-card rounded-2xl card-shadow overflow-hidden mt-4">
        {sportsList.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhum esporte cadastrado.</p>
        ) : (
          <div className="divide-y divide-border">
            {sportsList.map((sport) => (
              <div
                key={sport}
                className="flex items-center justify-between px-4 py-3 animate-in fade-in"
              >
                <span className="text-foreground text-sm font-bold">{sport}</span>
                <button
                  onClick={() => handleRemove(sport)}
                  className="text-muted-foreground hover:text-destructive transform hover:scale-110 active:scale-90 transition-all duration-200"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto bg-destructive/10 text-destructive rounded-xl border border-destructive/20 mt-10 space-y-4">
          <h2 className="text-xl font-bold">¡React Crash! (Error Boundary)</h2>
          <p className="text-sm font-mono whitespace-pre-wrap">{this.state.error?.toString()}</p>
          <pre className="text-xs opacity-70 whitespace-pre-wrap overflow-x-auto p-4 bg-background/50 rounded-lg">
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg">Recargar página</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminSportsWrapper() {
  return (
    <ErrorBoundary>
      <AdminSports />
    </ErrorBoundary>
  );
}
