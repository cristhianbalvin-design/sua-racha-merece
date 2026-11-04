import { haversineMeters } from "@/features/buky/engine";

export interface LivePoint {
  lat: number;
  lon: number;
}

export interface LiveSnapshot {
  /** Recorrido hecho (para dibujarlo en el mapa), con puntos cada ≥ 5 m. */
  track: LivePoint[];
  distanceM: number;
  /** Velocidad actual (media de los últimos ~15 s); null si aún no hay datos. */
  speedKmh: number | null;
}

const MIN_STEP_M = 4; // por debajo es ruido del GPS estando quieto
const TRACK_STEP_M = 5;
const SPEED_WINDOW_MS = 15_000;
const MAX_TRACK = 6000;

/**
 * Distancia, velocidad y recorrido EN VIVO para la pantalla del entrenamiento. Solo usa lecturas
 * que el motor aceptó (precisión ≤ 25 m, sin saltos). Es informativo: los Bukys los decide el servidor.
 */
export class LiveStats {
  private track: LivePoint[] = [];
  private distanceM = 0;
  private last: (LivePoint & { t: number }) | null = null;
  private recent: (LivePoint & { t: number; d: number })[] = [];

  add(lat: number, lon: number, t: number): void {
    if (!this.last) {
      this.last = { lat, lon, t };
      this.track.push({ lat, lon });
      this.recent.push({ lat, lon, t, d: 0 });
      return;
    }
    const step = haversineMeters(this.last.lat, this.last.lon, lat, lon);
    if (step >= MIN_STEP_M) {
      this.distanceM += step;
      this.last = { lat, lon, t };
      const tail = this.track[this.track.length - 1];
      if (haversineMeters(tail.lat, tail.lon, lat, lon) >= TRACK_STEP_M && this.track.length < MAX_TRACK) this.track.push({ lat, lon });
    } else {
      this.last = { ...this.last, t };
    }
    this.recent.push({ lat, lon, t, d: this.distanceM });
    while (this.recent.length > 2 && t - this.recent[0].t > SPEED_WINDOW_MS) this.recent.shift();
  }

  snapshot(): LiveSnapshot {
    let speedKmh: number | null = null;
    if (this.recent.length >= 2) {
      const a = this.recent[0];
      const b = this.recent[this.recent.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt >= 4) speedKmh = ((b.d - a.d) / dt) * 3.6;
    }
    return { track: [...this.track], distanceM: this.distanceM, speedKmh };
  }
}
