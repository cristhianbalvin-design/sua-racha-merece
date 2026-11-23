import type { PublicRaffleWinner } from "./api";

/** Sólo los campos aprobados para las vistas del atleta. */
export function publicWinnerLabel(winner: Pick<PublicRaffleWinner, "initials" | "nickname">): string {
  return `${winner.initials}${winner.nickname ? ` · @${winner.nickname}` : ""}`;
}
