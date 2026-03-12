const PlanBadge = ({ plan }: { plan: 'Freemium' | 'Premium' }) => {
  return (
    <span
      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
        plan === 'Premium'
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {plan}
    </span>
  );
};

export default PlanBadge;
