/**
 * Validaciones del registro (requerimientos del cliente). Las mismas reglas están en la base
 * (paso 15: CHECK de instagram y barrio), así que el servidor también las hace cumplir.
 */

export const cleanInstagram = (v: string) => v.trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");

export const isValidInstagram = (v: string) => /^[A-Za-z0-9._]{1,30}$/.test(cleanInstagram(v));

export const isValidNeighborhood = (v: string) => {
  const t = v.trim();
  return t.length >= 3 && t.length <= 80;
};

/** Mínimo 8 caracteres, con al menos una letra y un número. */
export const isValidPassword = (v: string) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const isValidName = (v: string) => v.trim().length >= 2;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("pt-BR") : "";
}

export function isValidNickname(value: string): boolean {
  const name = value.trim();
  return !name || (name.length >= 2 && name.length <= 20 && /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .-]+$/.test(name)
    && !/(puta|porra|caralho|merda|buceta)/i.test(name));
}

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits.slice(2, 13) : digits.slice(0, 11);
}

export function maskPhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? `-${rest.slice(split)}` : ""}`;
}

export function normalizePhone(value: string): string | null {
  const digits = phoneDigits(value);
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : null;
}

/** Igual que br_norm() en SQL: sin acentos, minúsculas y espacios simples. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
