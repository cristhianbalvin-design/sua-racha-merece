import { supabase } from './supabase';
import type { User, Campaign, Participation, Winner, HomePopup, TermsAndConditions } from '../data/mockData';
import { toast } from 'sonner';

// Map Row to User interface
const mapUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  city: row.city || '',
  country: row.country || '',
  sport: row.sport || '',
  phone: row.phone || '',
  gender: row.gender || '',
  birthDate: row.birth_date || '',
  avatar: row.avatar_url || '',
  plan: row.plan as 'Freemium' | 'Premium',
  userStatus: row.user_status,
  campaignsParticipated: row.campaigns_participated,
  campaignsWon: row.campaigns_won,
  photos: [],
  createdAt: row.created_at || '',
  acceptedTerms: row.accepted_terms,
  acceptedTermsAt: row.accepted_terms_at,
});

export const apiGetUsers = async (): Promise<User[]> => {
  const [{ data }, { data: numberRows, error: numberError }] = await Promise.all([
    supabase.from('users').select('*').neq('role', 'ADMIN'),
    supabase.rpc('get_user_athlete_numbers'),
  ]);
  if (numberError) console.error('Error loading athlete numbers:', numberError);
  const athleteNumbers = new Map<string, number>(
    (numberRows || []).map((row: { user_id: string; athlete_number: number }) => [row.user_id, Number(row.athlete_number)])
  );
  return (data || []).map((row) => ({ ...mapUser(row), athleteNumber: athleteNumbers.get(row.id) }));
};

export const apiGetAthleteNumber = async (userId: string): Promise<number | null> => {
  const { data, error } = await supabase.rpc('get_user_athlete_numbers');
  if (error) {
    console.error('Error loading athlete number:', error);
    return null;
  }
  const match = (data || []).find((row: { user_id: string }) => row.user_id === userId);
  return match ? Number(match.athlete_number) : null;
};

export const apiUpdateUser = async (userId: string, updates: Partial<User>) => {
  const mapping: any = {};
  if (updates.name) mapping.name = updates.name;
  if (updates.city) mapping.city = updates.city;
  if (updates.country) mapping.country = updates.country;
  if (updates.sport) mapping.sport = updates.sport;
  if (updates.phone !== undefined) mapping.phone = updates.phone;
  if (updates.gender !== undefined) mapping.gender = updates.gender;
  if (updates.birthDate !== undefined) mapping.birth_date = updates.birthDate || null;
  if (updates.avatar) mapping.avatar_url = updates.avatar;

  const { data, error } = await supabase.from('users').update(mapping).eq('id', userId).select('*').single();
  if (error) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message);
  }
  return data ? mapUser(data) : null;
};

export const apiToggleUserStatus = async (userId: string, currentStatus: string) => {
  const next = currentStatus === 'Ativo' ? 'Desabilitado' : 'Ativo';
  await supabase.from('users').update({ user_status: next }).eq('id', userId);
};

export const apiDeleteUser = async (userId: string) => {
  await supabase.from('notifications').delete().eq('user_id', userId);
  await supabase.from('participations').delete().eq('user_id', userId);

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    console.error('Error deleting user profile:', error);
    throw new Error(error.message);
  }

  // Deletes the auth.users record via a SECURITY DEFINER RPC function
  const { error: rpcError } = await supabase.rpc('delete_auth_user', { target_user_id: userId });
  if (rpcError) {
    console.error('Auth user delete failed (run SQL in Supabase):', rpcError);
  }
};

// Campaigns
const mapCampaign = (row: any): Campaign => ({
  id: row.id,
  name: row.name || row.description || '',
  sport: row.sport,
  sportIcon: row.sport_icon,
  city: row.city,
  region: row.region,
  startDate: row.start_date,
  endDate: row.end_date,
  description: row.description,
  winnersCount: row.winners_count,
  prize: row.prize,
  imageUrl: row.image_url ? normalizeStoragePublicUrl(row.image_url) : undefined,
  imageUrlMobile: row.image_url_mobile ? normalizeStoragePublicUrl(row.image_url_mobile) : undefined,
  plan: row.plan_required,
  instagramOptional: row.instagram_optional,
  instagramHashtags: row.instagram_hashtags,
  status: row.status,
  isHidden: row.is_hidden,
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

const getTodayInSaoPaulo = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
};

export const apiGetAvailableCampaigns = async (): Promise<Campaign[]> => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'Aberto')
    .gte('end_date', getTodayInSaoPaulo())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error get available campaigns:', error);
    toast.error('Erro bd: ' + error.message);
  }

  return (data || []).map(mapCampaign);
};

export const apiAddCampaign = async (c: Campaign): Promise<Campaign | null> => {
  const row = {
    name: c.name,
    sport: c.sport,
    sport_icon: c.sportIcon,
    city: c.city,
    region: c.region,
    start_date: c.startDate,
    end_date: c.endDate,
    description: c.description,
    winners_count: c.winnersCount,
    prize: c.prize,
    image_url: c.imageUrl,
    image_url_mobile: c.imageUrlMobile,
    plan_required: c.plan,
    instagram_optional: c.instagramOptional,
    instagram_hashtags: c.instagramHashtags,
    status: c.status,
    is_hidden: c.isHidden || false
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
  if (updates.isHidden !== undefined) row.is_hidden = updates.isHidden;
  if (updates.name) row.name = updates.name;
  if (updates.sport) row.sport = updates.sport;
  if (updates.city) row.city = updates.city;
  if (updates.region) row.region = updates.region;
  if (updates.startDate) row.start_date = updates.startDate;
  if (updates.endDate) row.end_date = updates.endDate;
  if (updates.description) row.description = updates.description;
  if (updates.winnersCount !== undefined) row.winners_count = updates.winnersCount;
  if (updates.prize) row.prize = updates.prize;
  if (updates.imageUrl) row.image_url = updates.imageUrl;
  if (updates.imageUrlMobile) row.image_url_mobile = updates.imageUrlMobile;
  if (updates.plan) row.plan_required = updates.plan;
  if (updates.instagramOptional !== undefined) row.instagram_optional = updates.instagramOptional;
  if (updates.instagramHashtags !== undefined) row.instagram_hashtags = updates.instagramHashtags;

  const { data, error } = await supabase.from('campaigns').update(row).eq('id', id).select('*').single();
  if (error) {
    console.error('Error updating campaign:', error);
    toast.error('Erro ao atualizar: ' + error.message);
  }
  return data ? mapCampaign(data) : null;
}

export const apiDeleteCampaign = async (id: string) => {
  // Remover referências para evitar falhas de chave estrangeira
  await supabase.from('notifications').delete().eq('campaign_id', id);
  await supabase.from('participations').delete().eq('campaign_id', id);

  // Excluir a campanha
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) {
    console.error('Error delete campaign:', error);
    throw error;
  }
};

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
    prequalification: row.prequalification || undefined,
    timestamp: row.created_at
  };
};

export const apiGetParticipations = async (): Promise<Participation[]> => {
  const { data } = await supabase.from('participations').select('*').order('created_at', { ascending: false });
  return (data || []).map(mapPart);
};

export const apiGetParticipationCountsByCampaign = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase.from('participations').select('campaign_id');
  if (error) {
    console.error('Error loading campaign participation counts:', error);
    return {};
  }
  return (data || []).reduce<Record<string, number>>((counts, row) => {
    if (row.campaign_id) counts[row.campaign_id] = (counts[row.campaign_id] || 0) + 1;
    return counts;
  }, {});
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
  if (updates.prequalification !== undefined) row.prequalification = updates.prequalification;

  const { data, error } = await supabase.from('participations').update(row).eq('id', id).select('*').single();
  if (error) {
    console.error('Error update participation:', error);
    toast.error('Erro ao atualizar participação: ' + error.message);
  }
  return data ? mapPart(data) : null;
};

interface ParticipationEvidenceUpdate {
  comment: string;
  instagram: boolean;
  photo: string[];
  instagramPhoto?: string;
}

export const apiSaveOwnParticipationEvidence = async (
  id: string,
  userId: string,
  expectedStatus: 'Em curso' | 'Concluído',
  evidence: ParticipationEvidenceUpdate
): Promise<Participation> => {
  const photoUrl = JSON.stringify({
    media: evidence.photo,
    igScreenshot: evidence.instagramPhoto,
    prizeDelivered: false,
  });
  const { data, error } = await supabase
    .from('participations')
    .update({
      status: 'Concluído',
      comment: evidence.comment,
      instagram_posted: evidence.instagram,
      photo_url: photoUrl,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', expectedStatus)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error('A participação mudou de estado e não pode mais ser editada.');
  }
  return mapPart(data);
};

// Masters API
export const apiGetSports = async (): Promise<string[]> => {
  const { data } = await supabase.from('sports').select('name').order('name');
  return (data || []).map(d => d.name);
};
export const apiGetSportsWithId = async (): Promise<{id: string, name: string}[]> => {
  const { data } = await supabase.from('sports').select('id, name').order('name');
  return data || [];
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
export const apiGetRegionsWithId = async (): Promise<{id: string, name: string}[]> => {
  const { data } = await supabase.from('regions').select('id, name').order('name');
  return data || [];
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
  const { data, error } = await supabase
    .from('public_winners')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error get public winners:', error);
    return [];
  }

  if (!data) return [];

  return data.map((p: any, idx) => {
    const user: User = {
      id: p.user_id,
      name: p.user_name,
      city: p.user_city || '',
      country: '',
      sport: p.user_sport || '',
      plan: 'Freemium',
      avatar: p.user_avatar_url || '',
      campaignsParticipated: 0,
      campaignsWon: 0,
      userStatus: 'Ativo',
      photos: [],
    };
    const camp = mapCampaign({
      id: p.campaign_id,
      sport: p.campaign_sport,
      city: p.campaign_city,
      start_date: p.campaign_start_date,
      prize: p.campaign_prize,
    });
    const medals = ['🥇', '🥈', '🥉'];
    return {
      id: p.id,
      user,
      camp,
      photo: p.winner_photo_url,
      prize: camp.prize,
      medal: medals[idx % 3],
      campaignMonth: camp.startDate ? new Date(camp.startDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'N/A',
      justification: `Nota Total: ${p.total_score || 0}. Excelente atitude e compromisso.`
    };
  });
};

export const apiGetAdminWinners = async () => {
  const { data, error } = await supabase
    .from('participations')
    .select(`
      *,
      users (*),
      campaigns (*)
    `)
    .eq('status', 'Ganhador')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error get admin winners:', error);
    return [];
  }

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
  
  const { error } = await supabase.storage.from('evidences').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });
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
  
  const { error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });
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

// Home popups
const normalizeStoragePublicUrl = (url: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!url || !supabaseUrl) return url;

  try {
    const parsed = new URL(url);
    const proxyPrefix = '/supabase/storage/v1/object/public/';
    if (parsed.pathname.startsWith(proxyPrefix)) {
      return `${supabaseUrl}/storage/v1/object/public/${parsed.pathname.slice(proxyPrefix.length)}`;
    }
  } catch (_) {
    return url;
  }

  return url;
};

const mapHomePopup = (row: any): HomePopup => ({
  id: row.id,
  name: row.name,
  imageUrl: normalizeStoragePublicUrl(row.image_url),
  targetUrl: row.target_url,
  startDate: row.start_date,
  endDate: row.end_date,
  createdAt: row.created_at,
});

export const apiGetHomePopups = async (): Promise<HomePopup[]> => {
  const { data, error } = await supabase
    .from('home_popups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error get home popups:', error);
    toast.error('Erro bd: ' + error.message);
    return [];
  }
  return (data || []).map(mapHomePopup);
};

export const apiGetActiveHomePopup = async (): Promise<HomePopup | null> => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('home_popups')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Error get active home popup:', error);
    return null;
  }
  return data ? mapHomePopup(data) : null;
};

export const apiAddHomePopup = async (popup: Omit<HomePopup, 'id' | 'createdAt'>): Promise<HomePopup | null> => {
  const row = {
    name: popup.name,
    image_url: popup.imageUrl,
    target_url: popup.targetUrl,
    start_date: popup.startDate,
    end_date: popup.endDate,
  };
  const { data, error } = await supabase.from('home_popups').insert(row).select('*').single();
  if (error) {
    console.error('Error insert home popup:', error);
    toast.error('Erro bd: ' + error.message);
    return null;
  }
  return data ? mapHomePopup(data) : null;
};

export const apiDeleteHomePopup = async (id: string) => {
  const { error } = await supabase.from('home_popups').delete().eq('id', id);
  if (error) {
    console.error('Error delete home popup:', error);
    throw error;
  }
};

export const apiUploadHomePopupImage = async (file: File): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  
  const { error } = await supabase.storage.from('popups').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) {
    console.error('Upload home popup error:', error);
    toast.error('Erro ao enviar imagem: ' + error.message);
    return null;
  }
  
  const { data } = supabase.storage.from('popups').getPublicUrl(fileName);
  return normalizeStoragePublicUrl(data.publicUrl);
};

// ──────────────────────────────────────────────
export const apiUploadCampaignImage = async (file: File): Promise<string | null> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabase.storage.from('popups').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    console.error('Upload campaign image error:', error);
    toast.error('Erro ao enviar imagem da campanha: ' + error.message);
    return null;
  }

  const { data } = supabase.storage.from('popups').getPublicUrl(fileName);
  return normalizeStoragePublicUrl(data.publicUrl);
};

// Terms & Conditions
// ──────────────────────────────────────────────

const mapTerms = (row: any): TermsAndConditions => ({
  id: row.id,
  content: row.content,
  version: row.version,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const apiGetActiveTerms = async (): Promise<TermsAndConditions | null> => {
  const { data, error } = await supabase
    .from('terms_and_conditions')
    .select('*')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active terms:', error);
    return null;
  }
  return data ? mapTerms(data) : null;
};

export const apiGetTermsHistory = async (): Promise<TermsAndConditions[]> => {
  const { data, error } = await supabase
    .from('terms_and_conditions')
    .select('*')
    .order('version', { ascending: false });

  if (error) {
    console.error('Error fetching terms history:', error);
    return [];
  }
  return (data || []).map(mapTerms);
};

export const apiSaveTerms = async (content: string): Promise<TermsAndConditions | null> => {
  // Get current active version to increment it
  const activeTerms = await apiGetActiveTerms();
  const nextVersion = activeTerms ? activeTerms.version + 1 : 1;

  // Set all previous versions to is_active = false
  const { error: updateError } = await supabase
    .from('terms_and_conditions')
    .update({ is_active: false })
    .eq('is_active', true);

  if (updateError) {
    console.error('Error deactivating previous terms:', updateError);
    toast.error('Erro ao desativar termos anteriores: ' + updateError.message);
    return null;
  }

  // Insert the new active version
  const { data, error } = await supabase
    .from('terms_and_conditions')
    .insert({
      content,
      version: nextVersion,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving terms and conditions:', error);
    toast.error('Erro ao salvar termos: ' + error.message);
    return null;
  }

  toast.success('Termos e Condições atualizados com sucesso!');
  return data ? mapTerms(data) : null;
};

export const apiUpdateTermsContent = async (id: string, content: string): Promise<TermsAndConditions | null> => {
  const { data, error } = await supabase
    .from('terms_and_conditions')
    .update({ 
      content, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating terms content:', error);
    toast.error('Erro ao atualizar termos: ' + error.message);
    return null;
  }
  
  toast.success('Termos atualizados com sucesso!');
  return data ? mapTerms(data) : null;
};

export const apiActivateTermsVersion = async (id: string): Promise<boolean> => {
  // Deactivate all active ones
  const { error: updateError } = await supabase
    .from('terms_and_conditions')
    .update({ is_active: false })
    .eq('is_active', true);

  if (updateError) {
    console.error('Error deactivating previous terms:', updateError);
    toast.error('Erro ao desativar termos anteriores: ' + updateError.message);
    return false;
  }

  // Activate selected one
  const { error: activateError } = await supabase
    .from('terms_and_conditions')
    .update({ is_active: true })
    .eq('id', id);

  if (activateError) {
    console.error('Error activating terms version:', activateError);
    toast.error('Erro ao ativar versão: ' + activateError.message);
    return false;
  }

  toast.success('Versão dos Termos ativada com sucesso!');
  return true;
};

export const apiAcceptTermsForOAuthUser = async (userId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('users')
    .update({ 
      accepted_terms: true, 
      accepted_terms_at: new Date().toISOString() 
    })
    .eq('id', userId);

  if (error) {
    console.error('Error accepting terms for OAuth user:', error);
    toast.error('Erro ao aceitar termos: ' + error.message);
    return false;
  }
  return true;
};

// ──────────────────────────────────────────────
// Additional specific APIs for Admin Event Photos
// ──────────────────────────────────────────────

export interface Photographer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  is_hidden?: boolean;
  created_at: string;
}

export const apiGetPhotographers = async (): Promise<Photographer[]> => {
  const { data } = await supabase.from('photographers').select('*').order('name');
  return data || [];
};

export const apiAddPhotographer = async (name: string, email?: string, phone?: string, photoUrl?: string): Promise<Photographer | null> => {
  const { data, error } = await supabase.from('photographers').insert({ name, email: email || null, phone: phone || null, photo_url: photoUrl || null }).select('*').single();
  if (error) {
    console.error("Erro ao adicionar fotógrafo:", error);
    toast.error('Erro ao adicionar fotógrafo: ' + error.message);
    throw new Error(error.message);
  }
  return data;
};

export const apiUpdatePhotographer = async (id: string, updates: Partial<Photographer>): Promise<Photographer | null> => {
  const row: any = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email || null;
  if (updates.phone !== undefined) row.phone = updates.phone || null;
  if (updates.photo_url !== undefined) row.photo_url = updates.photo_url || null;
  if (updates.is_hidden !== undefined) row.is_hidden = updates.is_hidden;

  const { data, error } = await supabase.from('photographers').update(row).eq('id', id).select('*').single();
  if (error) {
    console.error("Erro ao atualizar fotógrafo:", error);
    toast.error('Erro ao atualizar fotógrafo: ' + error.message);
    throw new Error(error.message);
  }
  return data;
};

export const apiUploadPhotographerPhoto = async (file: File): Promise<string | null> => {
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `photographers/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    console.error('Error uploading photographer photo:', error);
    toast.error('Erro ao enviar foto: ' + error.message);
    return null;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
};

export const apiDeletePhotographer = async (id: string): Promise<void> => {
  const { error } = await supabase.from('photographers').delete().eq('id', id);
  if (error) {
    console.error("Erro ao remover fotógrafo:", error);
    toast.error('Erro ao remover fotógrafo: ' + error.message);
    throw new Error(error.message);
  }
};

export const apiGetUniqueCities = async (): Promise<string[]> => {
  const { data } = await supabase.from('users').select('city').not('city', 'is', null);
  if (!data) return [];
  const uniqueCities = Array.from(new Set(data.map(d => d.city).filter(Boolean)));
  return uniqueCities.sort() as string[];
};
