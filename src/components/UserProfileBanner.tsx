import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, User as UserIcon, Camera, Target, Users, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetParticipations } from '@/lib/mockApi';

const spring = { type: 'spring' as const, duration: 0.4, bounce: 0 };

const UserProfileBanner = () => {
  const { user } = useAuth();
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [participationsCount, setParticipationsCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiGetParticipations().then((parts) => {
      const mine = parts.filter((p) => p.userId === user.id);
      setCampaignsCount(new Set(mine.map((p) => p.campaignId)).size);
      setParticipationsCount(mine.length);
      setPhotosCount(
        mine.flatMap((p) => {
          if (!p.photo) return [];
          return Array.isArray(p.photo) ? p.photo : [p.photo];
        }).length
      );
    });
  }, [user]);

  if (!user) return null;

  const location = [user.city, user.country].filter(Boolean).join(' - ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="px-4 md:px-8 pt-4 pb-2 max-w-4xl mx-auto w-full"
    >
      <div className="bg-white text-black rounded-2xl overflow-hidden border-2 border-primary/35 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
        {/* ── Mobile layout: split row ── */}
        <div className="flex md:hidden">
          {/* Profile info — 2/3 para alinhar com as duas primeiras colunas de stats */}
          <div className="flex items-center gap-3 p-4 w-2/3 min-w-0">
            <div className="relative shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-primary shadow-[0_4px_12px_rgba(26,122,46,0.28)]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary shadow-[0_4px_12px_rgba(26,122,46,0.28)]">
                  <UserIcon size={24} className="text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold italic text-sm text-black leading-tight truncate">
                {user.name}
              </p>
              <p className="text-neutral-700 text-[11px] mb-0.5 font-medium">Atleta Amador</p>
              {location && (
                <p className="text-neutral-700 text-[11px] flex items-center gap-1 mb-1">
                  <MapPin size={10} className="shrink-0 text-primary" />
                  {location}
                </p>
              )}
              <Link to="/perfil" className="text-primary text-[11px] font-bold hover:text-secondary transition-colors">
                Editar perfil &rsaquo;
              </Link>
            </div>
          </div>

          {/* Promo panel — 1/3 para alinhar com MINHAS FOTOS */}
          <div className="w-1/3 shrink-0 border-l-2 border-primary/30 flex flex-col items-center justify-center gap-2 p-3 bg-[#E6F7EE]">
            <div className="w-8 h-8 rounded-full bg-white border-2 border-primary/35 flex items-center justify-center shadow-[0_4px_10px_rgba(26,122,46,0.16)]">
              <Camera size={15} className="text-primary" />
            </div>
            <p className="text-[9px] text-center text-neutral-800 leading-snug font-bold">
              Em breve encontramos suas fotos
            </p>
          </div>
        </div>

        {/* ── Desktop layout: split row ── */}
        <div className="hidden md:flex">
          {/* Profile info — 2/3 */}
          <div className="w-2/3 flex flex-col items-center justify-center text-center py-7 px-8">
            <div className="relative mb-4">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover ring-2 ring-primary shadow-[0_6px_18px_rgba(26,122,46,0.28)]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary shadow-[0_6px_18px_rgba(26,122,46,0.28)]">
                  <UserIcon size={36} className="text-primary" />
                </div>
              )}
              <Link
                to="/perfil"
                className="absolute -bottom-1 -right-1 bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_0_3px_#fff,0_4px_12px_rgba(26,122,46,0.4)] hover:bg-secondary transition-colors"
                aria-label="Editar perfil"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2.5 2.5 0 013.536 3.536L12.536 16H9v-3z" />
                </svg>
              </Link>
            </div>
            <h2 className="font-bold italic text-2xl text-black mb-1">{user.name}</h2>
            {location && (
              <p className="text-neutral-700 text-sm mb-0.5">{location}</p>
            )}
            {user.email && (
              <p className="text-neutral-600 text-xs mb-1">{user.email}</p>
            )}
            {user.sport && (
              <p className="text-secondary text-sm font-bold">{user.sport}</p>
            )}
          </div>

          {/* Promo panel — 1/3, alinhado com MINHAS FOTOS */}
          <div className="w-1/3 shrink-0 border-l-2 border-primary/30 flex flex-col items-center justify-center gap-3 p-6 bg-[#E6F7EE]">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-primary/35 flex items-center justify-center shadow-[0_4px_12px_rgba(26,122,46,0.16)]">
              <Camera size={22} className="text-primary" />
            </div>
            <p className="text-xs text-center text-neutral-800 leading-snug font-bold">
              Em breve encontramos suas fotos
            </p>
          </div>
        </div>

        {/* ── Stats row (shared) ── */}
        <div className="grid grid-cols-3 border-t-2 border-primary/30 bg-white">
          {[
            { value: campaignsCount, label: 'CAMPANHAS', icon: Target, color: 'text-primary', bg: 'bg-primary/15' },
            { value: participationsCount, label: 'PARTICIPAÇÕES', icon: Users, color: 'text-secondary', bg: 'bg-secondary/15' },
            { value: photosCount, label: 'MINHAS FOTOS', icon: ImageIcon, color: 'text-primary', bg: 'bg-primary/15' },
          ].map(({ value, label, icon: Icon, color, bg }, i) => (
            <div
              key={label}
              className={`text-center py-3 ${i > 0 ? 'border-l-2 border-primary/20' : ''}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${bg}`}>
                  <Icon size={14} className={color} />
                </span>
                <span className={`font-bold text-xl leading-tight ${color}`}>
                  {value}
                </span>
              </div>
              <p className="text-[9px] text-neutral-800 text-ui mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default UserProfileBanner;
