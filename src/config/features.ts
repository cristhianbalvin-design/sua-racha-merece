/**
 * Global feature flags derived from environment variables.
 * Enables clean conditional rendering across the application.
 */

export const SHOW_FACE_SEARCH = import.meta.env.VITE_SHOW_FACE_SEARCH === 'true';

/** App del atleta con Buky (diseño nuevo). Apagada: /app existe pero la entrada sigue siendo la web actual. */
import { IS_NATIVE } from '../lib/platform';

/** En la app nativa siempre se entra a /app. */
export const PAYMENTS_ENABLED = !IS_NATIVE;
export const PAYMENT_MANAGEMENT_MESSAGE = 'Gerencie seu plano e seu saldo em 3buk.com.';

export const SHOW_BUKY_APP = IS_NATIVE || import.meta.env.VITE_SHOW_BUKY_APP === 'true';
