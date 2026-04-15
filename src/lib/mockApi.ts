import { supabase } from './supabase';
import type { User, Campaign, Participation, Winner } from '../data/mockData';
import { toast } from 'sonner';

// Map Row to User interface
const mapUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  city: row.city || '',
  country: row.country || '',
  sport: row.sport || '',
  avatar: row.avatar_url || '',
  plan: row.plan as 'Freemium' | 'Premium',
  userStatus: row.user_status,
  campaignsParticipated: row.campaigns_participated,
  campaignsWon: row.campaigns_won,
  photos: [],
  createdAt: row.created_at || '',
});

export const apiGetUsers = async (): Promise<User[]> => {
  const { data } = await supabase.from('users').select('*').neq('role', 'ADMIN');
  return (data || []).map(mapUser);
};

export const apiUpdateUser = async (userId: string, updates: Partial<User>) => {
  const mapping: any = {};
  if (updates.name) mapping.name = updates.name;
  if (updates.city) mapping.city = updates.city;
  if (updates.country) mapping.country = updates.country;
  if (updates.sport) mapping.sport = updates.sport;
  if (updates.avatar) mapping.avatar_url = updates.avatar;

  const { data } = await supabase.from('users').update(mapping).eq('id', userId).select('*').single();
  return data ? mapUser(data) : null;
};

export const apiToggleUserStatus = async (userId: string, currentStatus: string) => {
  const next = currentStatus === 'Ativo' ? 'Desabilitado' : 'Ativo';
  await supabase.from('users').update({ user_status: next }).eq('id', userId);
};

// Campaigns
const mapCampaign = (row: any): Campaign => ({
  id: row.id,
  sport: row.sport,
  sportIcon: row.sport_icon,
  city: row.city,
  region: row.region,
  startDate: row.start_date,
  endDate: row.end_date,
  description: row.description,
  winnersCount: row.winners_count,
  prize: row.prize,
  plan: row.plan_required,
  instagramOptional: row.instagram_optional,
  instagramHashtags: row.instagram_hashtags,
  status: row.status,
  createdAt: row.created_at
});

export const apiGetCampaigns = async (): Promise<Campaign[]> => {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error get campaigns:', error);
    toast.error('Erro bd: ' + error.message);
  }
  return (data || []).map(mapCampaign);
};

export const apiAddCampaign = async (c: Campaign): Promise<Campaign | null> => {
  const row = {
    sport: c.sport,
    sport_icon: c.sportIcon,
    city: c.city,
    region: c.region,
    start_date: c.startDate,
    end_date: c.endDate,
    description: c.description,
    winners_count: c.winnersCount,
    prize: c.prize,
    plan_required: c.plan,
    instagram_optional: c.instagramOptional,
    instagram_hashtags: c.instagramHashtags,
    status: c.status
  };
  const { data, error } = await supabase.from('campaigns').insert(row).select('*').single();
  if (error) {
    console.error('Error insert campaign:', error);
    toast.error('Erro bd: ' + error.message);
  }
  return data ? mapCampaign(data) : null;
};

export const apiUpdateCampaign = async (id: string, updates: Partial<Campaign>) => {
  const row: any = {};
  if (updates.status) row.status = updates.status;
  const { data } = await supabase.from('campaigns').update(row).eq('id', id).select('*').single();
  return data ? mapCampaign(data) : null;
}

// photo_url may be a single URL, a JSON array of URLs, or a JSON object {media: [], igScreenshot: string}
const parseMedia = (raw: string | null) => {
  if (!raw) return { photo: undefined, instagramPhoto: undefined, prizeDelivered: false };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { photo: parsed, instagramPhoto: undefined, prizeDelivered: false };
    if (parsed && typeof parsed === 'object') {
      const pUrl = parsed.media !== undefined ? parsed.media : parsed.photo;
      return { 
        photo: pUrl, 
        instagramPhoto: parsed.igScreenshot,
        prizeDelivered: !!parsed.prizeDelivered
      };
    }
  } catch (_) {/* not JSON */}
  return { photo: raw, instagramPhoto: undefined, prizeDelivered: false };
};

const mapPart = (row: any): Participation => {
  const media = parseMedia(row.photo_url);
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    participationStatus: row.status,
    photo: media.photo,
    instagramPhoto: media.instagramPhoto,
  comment: row.comment,
  instagram: row.instagram_posted,
    attitudeScore: row.attitude_score,
    commitmentScore: row.commitment_score,
    continuityScore: row.continuity_score,
    totalScore: row.total_score,
    prizeDelivered: row.prize_delivered,
    timestamp: row.created_at
  };
};

export const apiGetParticipations = async (): Promise<Participation[]> => {
  const { data } = await supabase.from('participations').select('*').order('created_at', { ascending: false });
  return (data || []).map(mapPart);
};

// Map app-level uppercase status to DB constraint values
const toDbStatus = (s: string): string => {
  const map: Record<string, string> = {
    'EM CURSO': 'Em curso',
    'CONCLUÍDO': 'Concluído',
    'NÃO CONCLUÍDO': 'Não concluído',
    'QUALIFICADO': 'Qualificado',
    'GANHADOR': 'Ganhador',
  };
  return map[s] || s;
};

export const apiAddParticipation = async (p: Partial<Participation>) => {
  const row = {
    user_id: p.userId,
    campaign_id: p.campaignId,
    status: toDbStatus(p.participationStatus || 'EM CURSO'),
    photo_url: p.photo,
    comment: p.comment,
    instagram_posted: p.instagram
  };
  const { data, error } = await supabase.from('participations').insert(row).select('*').single();
  if (error) {
    console.error('Error insert participation:', error);
    toast.error('Erro ao registrar participação: ' + error.message);
    return null;
  }
  return data ? mapPart(data) : null;
};

export const apiUpdateParticipation = async (id: string, updates: Partial<Participation>) => {
  const row: any = {};
  if (updates.participationStatus) row.status = toDbStatus(updates.participationStatus);
  if (updates.photo !== undefined || updates.instagramPhoto !== undefined || updates.prizeDelivered !== undefined) {
    const { data: curr } = await supabase.from('participations').select('photo_url').eq('id', id).single();
    const existing = curr ? parseMedia(curr.photo_url) : { photo: [], instagramPhoto: undefined, prizeDelivered: false };
    
    // Merge updates
    const newMedia = updates.photo !== undefined ? updates.photo : existing.photo;
    const newIg = updates.instagramPhoto !== undefined ? updates.instagramPhoto : existing.instagramPhoto;
    const newDelivered = updates.prizeDelivered !== undefined ? updates.prizeDelivered : existing.prizeDelivered;

    row.photo_url = JSON.stringify({
      media: newMedia,
      igScreenshot: newIg,
      prizeDelivered: newDelivered
    });
  }
  if (updates.comment !== undefined) row.comment = updates.comment;
  if (updates.instagram !== undefined) row.instagram_posted = updates.instagram;
  if (updates.attitudeScore !== undefined) row.attitude_score = updates.attitudeScore;
  if (updates.commitmentScore !== undefined) row.commitment_score = updates.commitmentScore;
  if (updates.continuityScore !== undefined) row.continuity_score = updates.continuityScore;
  if (updates.totalScore !== undefined) row.total_score = updates.totalScore;


  const { data, error } = await supabase.from('participations').update(row).eq('id', id).select('*').single();
  if (error) {
    console.error('Error update participation:', error);
    toast.error('Erro ao atualizar participação: ' + error.message);
  }
  return data ? mapPart(data) : null;
};

// Masters API
export const apiGetSports = async (): Promise<string[]> => {
  const { data } = await supabase.from('sports').select('name').order('name');
  return (data || []).map(d => d.name);
};
export const apiAddSport = async (name: string) => {
  const { error } = await supabase.from('sports').insert({ name });
  if (error) {
    console.error("Erro ao adicionar esporte:", error);
    toast.error('Erro ao adicionar esporte: ' + error.message);
    throw new Error(error.message);
  }
};
export const apiRemoveSport = async (name: string) => {
  await supabase.from('sports').delete().eq('name', name);
};

export const apiGetRegions = async (): Promise<string[]> => {
  const { data } = await supabase.from('regions').select('name').order('name');
  return (data || []).map(d => d.name);
};
export const apiAddRegion = async (name: string) => {
  const { error } = await supabase.from('regions').insert({ name });
  if (error) {
    console.error("Erro ao adicionar região:", error);
    toast.error('Erro ao adicionar região: ' + error.message);
    throw new Error(error.message);
  }
};
export const apiRemoveRegion = async (name: string) => {
  await supabase.from('regions').delete().eq('name', name);
};

export const apiGetWinners = async () => {
  const { data } = await supabase
    .from('participations')
    .select(`
      *,
      users (*),
      campaigns (*)
    `)
    .eq('status', 'Ganhador')
    .order('created_at', { ascending: true });
    
  if (!data) return [];
  
  return data.map((p: any, idx) => {
    const user = mapUser(p.users);
    const camp = mapCampaign(p.campaigns);
    const medals = ['🥇', '🥈', '🥉'];
    return {
      id: p.id,
      user,
      camp,
      photo: Array.isArray(parseMedia(p.photo_url).photo) 
        ? parseMedia(p.photo_url).photo[0] 
        : parseMedia(p.photo_url).photo,
      prize: camp.prize,
      medal: medals[idx % 3],
      prizeDelivered: p.prize_delivered !== null && p.prize_delivered !== undefined 
        ? p.prize_delivered 
        : parseMedia(p.photo_url).prizeDelivered,
      campaignMonth: camp.startDate ? new Date(camp.startDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'N/A',
      justification: `Nota Total: ${p.total_score || 0}. Excelente atitude e compromisso.`
    };
  });
};

export const initializeMockData = () => {
  // Empty stub so we don't break App.tsx existing import
};

export const apiUploadEvidence = async (file: File, userId: string): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage.from('evidences').upload(fileName, file);
  if (error) {
    console.error('Upload evidence error:', error);
    return null;
  }
  
  const { data } = supabase.storage.from('evidences').getPublicUrl(fileName);
  return data.publicUrl;
};

export const apiUploadAvatar = async (file: File, userId: string): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage.from('avatars').upload(fileName, file);
  if (error) {
    console.error('Upload avatar error:', error);
    return null;
  }
  
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
};

// ──────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: 'new_campaign' | 'participation_status' | 'campaign_status' | string;
  title: string;
  message: string;
  campaignId?: string;
  read: boolean;
  createdAt: string;
}

const mapNotification = (row: any): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  campaignId: row.campaign_id,
  read: row.read,
  createdAt: row.created_at,
});

export const apiGetNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error get notifications:', error);
    return [];
  }
  return (data || []).map(mapNotification);
};

export const apiMarkNotificationRead = async (id: string) => {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
};

export const apiMarkAllNotificationsRead = async (userId: string) => {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
};

