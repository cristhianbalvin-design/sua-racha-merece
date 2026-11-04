/**
 * Datos del registro que no se pudieron guardar aún (el proyecto exige confirmar el e-mail
 * antes de tener sesión). Se aplican en "Completar perfil" al primer ingreso.
 */
const KEY = "buky.pendingProfile.v1";

export interface PendingProfile {
  email: string;
  name: string;
  instagram: string;
  neighborhood: string;
  city_code: number;
}

export function savePendingProfile(email: string, p: Omit<PendingProfile, "email">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: email.toLowerCase(), ...p }));
  } catch {
    /* sin almacenamiento: el atleta completa los datos a mano */
  }
}

export function takePendingProfile(email: string | undefined | null): PendingProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingProfile;
    if (!email || p.email !== email.toLowerCase()) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
}
