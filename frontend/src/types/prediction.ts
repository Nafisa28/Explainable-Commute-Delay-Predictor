export type ConfidenceLevel = "low" | "medium" | "high";

export interface PredictionResponse {
  route_id: string;
  route_name: string;
  path_variant: string;
  departure_time: string; // ISO 8601 string
  predicted_delay_min: number;
  baseline_delay_min: number;
  confidence: ConfidenceLevel;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  path_variants: string[];
}
