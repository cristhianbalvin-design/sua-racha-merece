export type SponsorContact = {
  name?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  address?: string | null;
  contact_email?: string | null;
  maps_url?: string | null;
  instagram?: string | null;
  website?: string | null;
  logo_url?: string | null;
};

export const phoneValid = (value: string) => /^\+?[0-9]{8,15}$/.test(value);
export const mapsValid = (value: string) => /^https?:\/\/[^\s]+$/i.test(value);
export const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function whatsappLink(number: string | null | undefined, prizeTitle: string): string | null {
  if (!number || !phoneValid(number)) return null;
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Ganhei o cupom ${prizeTitle} na 3BUK e gostaria de saber como resgatar.`)}`;
}

export function mapsLink(mapsUrl?: string | null, address?: string | null): string | null {
  if (mapsUrl && mapsValid(mapsUrl)) return mapsUrl;
  return address?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}` : null;
}

export function instagramLink(handle?: string | null): string | null {
  const clean = handle?.replace(/^@/, "");
  return clean && /^[A-Za-z0-9._]{1,30}$/.test(clean) ? `https://www.instagram.com/${clean}/` : null;
}
