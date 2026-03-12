const StatusBadge = ({ status, icon }: { status: string; icon: string }) => {
  const colorMap: Record<string, string> = {
    'Em avaliação': 'bg-warning/20 text-warning',
    'Ganhador de patrocínio': 'bg-accent/20 text-accent',
    'Participação registrada': 'bg-success/20 text-success',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${colorMap[status] || 'bg-muted text-muted-foreground'}`}>
      <span>{icon}</span>
      {status}
    </span>
  );
};

export default StatusBadge;
