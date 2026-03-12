import { useState } from 'react';
import { motion } from 'framer-motion';
import { notifications, campaigns, currentUser } from '@/data/mockData';
import { Bell, CheckCheck } from 'lucide-react';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserNotifications = () => {
  const [notifList, setNotifList] = useState(
    notifications.filter((n) => n.userId === currentUser.id)
  );

  const markAllRead = () => {
    setNotifList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifList.filter((n) => !n.read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'winner': return '🏆';
      case 'status_change': return '🟡';
      case 'approved': return '✅';
      default: return '📢';
    }
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

      {notifList.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={48} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <h3 className="font-bold italic text-lg text-foreground mb-2">Nenhuma notificação.</h3>
          <p className="text-sm text-muted-foreground">Você será notificado sobre mudanças nas suas campanhas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifList.map((notif, i) => {
            const campaign = campaigns.find((c) => c.id === notif.campaignId);
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.06 }}
                className={`rounded-2xl p-4 card-shadow transition-colors ${
                  notif.read ? 'bg-card' : 'bg-card border-l-4 border-primary'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{getTypeIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.read ? 'text-muted-foreground' : 'text-foreground font-bold'}`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {campaign && (
                        <span className="text-xs text-secondary">{campaign.sport} — {campaign.city}</span>
                      )}
                      <span className="text-xs text-muted-foreground">· {notif.timestamp}</span>
                    </div>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserNotifications;
