/** Reglas del entrenamiento y progreso histórico (paso 24, buky_my_status). */
export interface TrainingRules {
  daily_cap: number;
  bukys_today: number;
  session_max_min: number;
  point_max_per_day: number;
  point_min_gap_min: number;
  bike_speed_kmh: number;
  bike_window_s: number;
  bike_window_nosteps_s: number;
  bike_warnings_to_stop: number;
  bike_stops_to_block: number;
}

export const DEFAULT_TRAINING_RULES: TrainingRules = {
  daily_cap: 12,
  bukys_today: 0,
  session_max_min: 60,
  point_max_per_day: 2,
  point_min_gap_min: 3,
  bike_speed_kmh: 25,
  bike_window_s: 30,
  bike_window_nosteps_s: 60,
  bike_warnings_to_stop: 3,
  bike_stops_to_block: 2,
};
