/**
 * Tipos compartidos de Buky. Se reutilizan cuando Buky pase a producción:
 * el formato de GpsReading es el que se enviará a Supabase.
 */

/** Una lectura de GPS tal como la entrega el teléfono. */
export interface GpsReading {
  /** UUID generado en el teléfono. Hace idempotente el envío al servidor. */
  id: string;
  sessionId: string;
  /** Número de orden dentro de la sesión (0, 1, 2…). */
  seq: number;
  /** Momento en que el GPS produjo la posición (ms desde epoch). */
  fixTime: number;
  /** Momento en que el código JS recibió la lectura (ms desde epoch). */
  receivedAt: number;
  lat: number;
  lon: number;
  /** Radio de incertidumbre horizontal en metros. */
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  bearing: number | null;
  /** true si Android marca la posición como simulada (ubicación falsa). */
  simulated: boolean;
}

/** Punto de una ruta Buky (geocerca circular). */
export interface BukyPoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radiusM: number;
}
