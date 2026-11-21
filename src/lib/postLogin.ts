export const DEFAULT_POST_LOGIN = '/app';

export function postLoginDestination(redirect: string | null | undefined): string {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : DEFAULT_POST_LOGIN;
}
