/**
 * Global feature flags derived from environment variables.
 * Enables clean conditional rendering across the application.
 */

export const SHOW_FACE_SEARCH = import.meta.env.VITE_SHOW_FACE_SEARCH === 'true';
