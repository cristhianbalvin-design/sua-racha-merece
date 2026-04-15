import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { apiGetUsers, apiToggleUserStatus } from '@/lib/mockApi';
import { User } from '@/data/mockData';

const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const AdminUsers = () => {
  const [userList, setUserList] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    apiGetUsers().then(setUserList);
  }, []);

  const handleDisable = async (id: string, currentStatus: string) => {
    await apiToggleUserStatus(id, currentStatus);
    setUserList(await apiGetUsers());
  };

  const states = Array.from(new Set(userList.map(u => u.country))).filter(Boolean);
  const cities = Array.from(new Set(userList.map(u => u.city))).filter(Boolean);
  const statuses = Array.from(new Set(userList.map(u => u.userStatus))).filter(Boolean);
  const plans = Array.from(new Set(userList.map(u => u.plan))).filter(Boolean);

  const filteredUsers = userList.filter(user => {
    if (statusFilter && user.userStatus !== statusFilter) return false;
    if (stateFilter && user.country !== stateFilter) return false;
    if (cityFilter && user.city !== cityFilter) return false;
    if (planFilter && user.plan !== planFilter) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-bold italic text-2xl text-foreground mb-6">USUÁRIOS REGISTRADOS</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-border text-sm rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Status (Todos)</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-card border border-border text-sm rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Estado (Todos)</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="bg-card border border-border text-sm rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Cidade (Todas)</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="bg-card border border-border text-sm rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Plano (Todos)</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="space-y-4">
        {filteredUsers.map((user, i) => (
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
                <p className="text-xs text-muted-foreground">{user.city} · {user.country}</p>
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
                <motion.button
                  onClick={() => handleDisable(user.id, user.userStatus)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className={
                    user.userStatus === 'Ativo'
                      ? 'bg-destructive text-destructive-foreground text-ui text-xs px-4 py-2 rounded-xl'
                      : 'bg-success/20 text-success border border-success/40 text-ui text-xs px-4 py-2 rounded-xl'
                  }
                >
                  {user.userStatus === 'Ativo' ? 'DESABILITAR' : 'HABILITAR'}
                </motion.button>
                <motion.button
                  onClick={() => setSelectedUser(user)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="bg-secondary/20 hover:bg-secondary/30 text-secondary text-ui text-xs px-4 py-2 rounded-xl"
                >
                  DETALLES
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden card-shadow relative"
          >
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <img src={selectedUser.avatar} alt={selectedUser.name} className="w-20 h-20 rounded-full object-cover img-outline" />
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedUser.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || 'Sem email guardado'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.userStatus}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Plano</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.plan}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Localização</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.city} - {selectedUser.country}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Esporte</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.sport}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Participações</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.campaignsParticipated}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Vitórias</p>
                    <p className="font-bold text-sm text-foreground">{selectedUser.campaignsWon}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
