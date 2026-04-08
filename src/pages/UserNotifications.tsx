import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trophy, Activity, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetNotifications,
  apiMarkAllNotificationsRead,
  type Notification,
} from '@/lib/mockApi';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const formatDate = (iso: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'new_campaign':     return <Megaphone size={18} className="text-secondary" />;
    case 'participation_status': return <Activity size={18} className="text-accent" />;
    case 'campaign_status':  return <Activity size={18} className="text-primary" />;
    case 'winner':           return <Trophy size={18} className="text-yellow-400" />;
    default:                 return <Bell size={18} className="text-muted-foreground" />;
  }
};

const UserNotifications = () => {
  const { user } = useAuth();
  const [notifList, setNotifList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiGetNotifications(user.id).then((data) => {
      setNotifList(data);
      setLoading(false);
    });
  }, [user]);

  const unreadCount = notifList.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    await apiMarkAllNotificationsRead(user.id);
    setNotifList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-bold italic text-xl text-foreground">NOTIFICAÇÕES</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <motion.button
            onClick={markAllRead}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="text-primary text-xs font-bold flex items-center gap-1.5"
          >
            <CheckCheck size={14} />
            MARCAR TODAS COMO LIDAS
          </motion.button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifList.length === 0 ? (
        <div className="text-center py-16 px-4 bg-card/30 rounded-3xl border border-dashed border-border/50 max-w-lg mx-auto mt-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell size={32} className="text-primary/50" />
          </div>
          <h3 className="font-bold italic text-xl text-foreground mb-3">SEM NOTIFICAÇÕES</h3>
          <p className="text-muted-foreground text-sm">
            Você será notificado quando houver mudanças nas suas campanhas ou participações.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifList.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.05 }}
              className={`rounded-2xl p-4 card-shadow transition-colors ${
                notif.read ? 'bg-card' : 'bg-card border-l-4 border-primary'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  {getTypeIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${notif.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {notif.title}
                  </p>
                  <p className={`text-sm mt-0.5 ${notif.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    📅 {formatDate(notif.createdAt)}
                  </p>
                </div>
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserNotifications;
