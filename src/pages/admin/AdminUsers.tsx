import { useState } from 'react';
import { motion } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { users } from '@/data/mockData';
import type { UserStatus } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminUsers = () => {
  const [userList, setUserList] = useState(users.map((u) => ({ ...u })));

  const handleDisable = (id: string) => {
    setUserList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, userStatus: 'Desabilitado' as UserStatus } : u))
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">USUÁRIOS REGISTRADOS</h1>

      <div className="space-y-4">
        {userList.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.06 }}
            className="bg-card rounded-2xl p-4 card-shadow"
          >
            <div className="flex items-center gap-4">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover img-outline flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground">{user.name}</h3>
                  <PlanBadge plan={user.plan} />
                </div>
                <p className="text-xs text-muted-foreground">{user.city} · {user.sport}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    user.userStatus === 'Ativo'
                      ? 'bg-success/20 text-success'
                      : 'bg-destructive/20 text-destructive'
                  }`}
                >
                  {user.userStatus}
                </span>
                {user.userStatus === 'Ativo' && (
                  <motion.button
                    onClick={() => handleDisable(user.id)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    className="bg-destructive text-destructive-foreground text-ui text-xs px-4 py-2 rounded-xl"
                  >
                    DESABILITAR
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminUsers;
