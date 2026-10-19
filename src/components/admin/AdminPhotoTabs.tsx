import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiCountPendingPhotos } from '@/lib/moderationApi';

/** Abas compartilhadas de "Fotos de eventos": Enviar fotos / Moderação (n) / Publicadas. */
const AdminPhotoTabs = ({ pendingCount }: { pendingCount?: number }) => {
  const location = useLocation();
  const [count, setCount] = useState<number | null>(pendingCount ?? null);

  useEffect(() => {
    if (pendingCount !== undefined) {
      setCount(pendingCount);
      return;
    }
    let active = true;
    apiCountPendingPhotos()
      .then((n) => active && setCount(n))
      .catch(() => active && setCount(null));
    return () => {
      active = false;
    };
  }, [pendingCount]);

  const status = new URLSearchParams(location.search).get('status');
  const onModeration = location.pathname === '/admin/fotos/moderacao';
  const tabs = [
    { to: '/admin/fotos', label: 'Enviar fotos', active: location.pathname === '/admin/fotos' },
    {
      to: '/admin/fotos/moderacao',
      label: `Moderação${count !== null ? ` (${count})` : ''}`,
      active: onModeration && status !== 'published',
    },
    { to: '/admin/fotos/moderacao?status=published', label: 'Publicadas', active: onModeration && status === 'published' },
  ];

  return (
    <nav className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Fotos de eventos">
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
            t.active ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
};

export default AdminPhotoTabs;
