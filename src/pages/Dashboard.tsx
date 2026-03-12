import { motion } from 'framer-motion';
import CampaignCard from '@/components/CampaignCard';
import StatusBadge from '@/components/StatusBadge';
import PlanBadge from '@/components/PlanBadge';
import { campaigns, participations, users, currentUser } from '@/data/mockData';

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const spring = { type: "spring" as const, duration: 0.4, bounce: 0 };

const Dashboard = () => {
  const userParticipations = participations.map((p) => {
    const campaign = campaigns.find((c) => c.id === p.campaignId);
    return { ...p, campaign };
  });

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      {/* Header mobile */}
      <div className="flex items-center justify-between mb-8 md:hidden">
        <div>
          <h1 className="font-bold italic text-xl text-foreground">Olá, {currentUser.name.split(' ')[0]}!</h1>
          <PlanBadge plan={currentUser.plan} />
        </div>
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-10 h-10 rounded-full object-cover img-outline"
        />
      </div>

      {/* Campanhas disponíveis */}
      <section className="mb-10">
        <h2 className="font-bold italic text-xl text-foreground mb-6">CAMPANHAS DISPONÍVEIS</h2>
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid md:grid-cols-2 gap-6"
        >
          {campaigns.map((campaign) => (
            <motion.div key={campaign.id} variants={fadeIn} transition={spring}>
              <CampaignCard campaign={campaign} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Minhas participações */}
      <section>
        <h2 className="font-bold italic text-xl text-foreground mb-6">MINHAS PARTICIPAÇÕES</h2>
        {userParticipations.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl block mb-3">🔥</span>
            <h3 className="font-bold italic text-lg text-foreground mb-2">Nenhuma participação ainda.</h3>
            <p className="text-sm text-muted-foreground">Participe de uma campanha e mostre sua raça!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userParticipations.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.06 }}
                className="bg-card rounded-2xl p-4 card-shadow flex items-center gap-4"
              >
                <img
                  src={p.photo}
                  alt="Participação"
                  className="w-16 h-16 rounded-xl object-cover img-outline flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm truncate">
                    {p.campaign?.description}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {p.campaign?.sport} — {p.campaign?.city}
                  </p>
                </div>
                <StatusBadge status={p.status} icon={p.statusIcon} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
