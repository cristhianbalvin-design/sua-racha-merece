import { motion } from 'framer-motion';
import PlanBadge from '@/components/PlanBadge';
import { currentUser } from '@/data/mockData';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const UserProfile = () => {
  const user = currentUser;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      {/* Profile header */}
      <motion.div
        {...fadeIn}
        transition={spring}
        className="flex flex-col items-center text-center mb-8"
      >
        <img
          src={user.avatar}
          alt={user.name}
          className="w-24 h-24 rounded-full object-cover img-outline mb-4"
        />
        <h1 className="font-bold italic text-2xl text-foreground mb-1">{user.name}</h1>
        <p className="text-muted-foreground text-sm mb-2">{user.city}, {user.country}</p>
        <p className="text-secondary text-sm font-bold mb-3">{user.sport}</p>
        <PlanBadge plan={user.plan} />
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-4 card-shadow text-center">
          <p className="text-2xl font-bold text-foreground">{user.campaignsParticipated}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">PARTICIPADAS</p>
        </div>
        <div className="bg-card rounded-2xl p-4 card-shadow text-center">
          <p className="text-2xl font-bold text-accent">{user.campaignsWon}</p>
          <p className="text-xs text-muted-foreground text-ui mt-1">GANHAS</p>
        </div>
      </div>

      {/* Photo gallery */}
      <h2 className="font-bold italic text-lg text-foreground mb-4">MINHAS FOTOS</h2>
      {user.photos.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📸</span>
          <p className="text-muted-foreground text-sm">Nenhuma foto enviada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {user.photos.map((photo, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              transition={spring}
              className="aspect-square rounded-2xl overflow-hidden"
            >
              <img
                src={photo}
                alt={`Foto ${i + 1}`}
                className="w-full h-full object-cover img-outline"
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
