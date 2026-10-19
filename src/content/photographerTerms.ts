/**
 * Termos do Fotógrafo — CONTEÚDO PROVISÓRIO.
 * O texto definitivo ainda não existe: deve ser definido pela 3BUK e validado juridicamente.
 * Não substituir os marcadores por texto inventado.
 */

export const PHOTOGRAPHER_TERMS_PENDING = '[TEXTO PENDENTE — definir com a 3BUK e validação jurídica]';

export interface PhotographerTermsSection {
  title: string;
  body: string;
}

export const PHOTOGRAPHER_TERMS_TITLE = 'Termos do fotógrafo';

export const PHOTOGRAPHER_TERMS_SECTIONS: PhotographerTermsSection[] = [
  { title: '1. Cessão de direitos de imagem', body: PHOTOGRAPHER_TERMS_PENDING },
  { title: '2. Dados pessoais e reconhecimento facial (LGPD)', body: PHOTOGRAPHER_TERMS_PENDING },
  { title: '3. Regras de moderação', body: PHOTOGRAPHER_TERMS_PENDING },
  { title: '4. Bônus e premiações', body: PHOTOGRAPHER_TERMS_PENDING },
];
