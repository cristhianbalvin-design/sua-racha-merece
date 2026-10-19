import { formatIsoDate, type PhotoStatus } from '@/lib/photoStatus';
import PhotoStatusBadge from './PhotoStatusBadge';

interface Props {
  imageUrl: string;
  status: PhotoStatus;
  title: string;
  city: string | null;
  eventDate: string | null;
  rejectionReason?: string | null;
}

/** Miniatura de uma foto do fotógrafo com estado e, se recusada, o motivo. */
const PhotoCard = ({ imageUrl, status, title, city, eventDate, rejectionReason }: Props) => (
  <div className="bg-card rounded-2xl card-shadow overflow-hidden flex flex-col">
    <div className="relative aspect-[4/3] bg-muted">
      <img src={imageUrl} alt={title} loading="lazy" className="w-full h-full object-cover" />
      <PhotoStatusBadge status={status} className="absolute top-2 left-2 bg-background/85" />
    </div>
    <div className="p-3 space-y-1">
      <p className="text-sm font-bold text-foreground truncate">{title}</p>
      <p className="text-xs text-muted-foreground truncate">
        {[city, formatIsoDate(eventDate)].filter((v) => v && v !== '—').join(' · ') || '—'}
      </p>
      {status === 'rejected' && (
        <p className="text-xs text-destructive">
          <span className="font-bold">Motivo da recusa:</span> {rejectionReason?.trim() || 'não informado'}
        </p>
      )}
    </div>
  </div>
);

export default PhotoCard;
