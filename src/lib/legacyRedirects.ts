/** Old public URLs kept as redirects into the athlete app. */
export const legacyRedirects = [
  ["/plano", "/app/completar"],
  ["/completar-perfil", "/app/completar"],
  ["/dashboard", "/app"],
  ["/campanhas", "/app/patrocinio"],
  ["/campanha/:id", "/app/patrocinio"],
  ["/campanha/:id/participar", "/app/patrocinio"],
  ["/participacoes", "/app/patrocinio"],
  ["/fotografias-3buk", "/app/fotos"],
  ["/biblioteca", "/app/fotos"],
  ["/notificacoes", "/app/avisos"],
  ["/perfil", "/app/perfil"],
  ["/ganhadores", "/app/sorteios"],
  ["/creditos", "/app/perfil/saldo"],
] as const;
