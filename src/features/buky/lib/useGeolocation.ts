import { useEffect, useState } from "react";

export interface Position {
  lat: number;
  lon: number;
  accuracy: number;
}

/** Posición del atleta mientras la pantalla está abierta (solo primer plano, sin guardar nada). */
export function useGeolocation(enabled = true) {
  const [pos, setPos] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
        setError(null);
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? "permission_denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return { pos, error };
}
