import type { RaffleResult } from "./adminApi";

export interface ResultSummary {
  winners: number;
  substitutes: number;
  pendingDelivery: number;
  delivered: number;
  withoutEligibleParticipants: number;
}

export function summarizeResults(results: readonly RaffleResult[]): ResultSummary {
  return results.reduce<ResultSummary>((summary, result) => {
    if (!result.user_id) {
      if (result.role === "winner") summary.withoutEligibleParticipants++;
      return summary;
    }

    if (result.role === "winner") summary.winners++;
    else summary.substitutes++;

    if (result.delivery_status === "pending" || result.delivery_status === "notified") summary.pendingDelivery++;
    if (result.delivery_status === "delivered") summary.delivered++;
    return summary;
  }, { winners: 0, substitutes: 0, pendingDelivery: 0, delivered: 0, withoutEligibleParticipants: 0 });
}
