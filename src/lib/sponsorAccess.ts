export function parseLinkError(search: string, hash: string): string | null {
  for (const value of [hash.replace(/^#/, ''), search.replace(/^\?/, '')]) {
    const params = new URLSearchParams(value);
    const error = params.get('error_code') || params.get('error');
    if (error) return error;
  }
  return null;
}

export function sponsorAccessView(search: string, hash: string, hasSession: boolean): 'request' | 'password' {
  if (parseLinkError(search, hash)) return 'request';
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return hasSession && (query.has('code') || fragment.has('access_token')) ? 'password' : 'request';
}
