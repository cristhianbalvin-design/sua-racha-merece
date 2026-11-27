export const LOCATION_DISCLOSURE_KEY = "buky.location-disclosure.v1";
export function hasLocationConsent(): boolean {
  try { return localStorage.getItem(LOCATION_DISCLOSURE_KEY) === "accepted"; } catch { return false; }
}
export function saveLocationConsent(): void {
  try { localStorage.setItem(LOCATION_DISCLOSURE_KEY, "accepted"); } catch { /* Ask again next time. */ }
}
let pending: Promise<boolean> | null = null;
export function requestLocationDisclosure(): Promise<boolean> {
  if (hasLocationConsent()) return Promise.resolve(true);
  if (!pending) pending = new Promise<boolean>((resolve) => window.dispatchEvent(new CustomEvent("buky-location-disclosure", { detail: resolve }))).finally(() => { pending = null; });
  return pending;
}
