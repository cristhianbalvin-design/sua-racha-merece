import { STATUS_BADGE_CLASS, STATUS_LABEL, type PhotoStatus } from '@/lib/photoStatus';

const PhotoStatusBadge = ({ status, className = '' }: { status: PhotoStatus; className?: string }) => (
  <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE_CLASS[status] ?? 'bg-muted text-muted-foreground border-border'} ${className}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

export default PhotoStatusBadge;
