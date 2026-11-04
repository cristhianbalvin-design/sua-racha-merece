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

/** Igual que br_norm() en SQL: sin acentos, minúsculas y espacios simples. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
