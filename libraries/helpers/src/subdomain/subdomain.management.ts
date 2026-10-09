import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  const url = parse(domain, { allowPrivateDomains: true });
  // Railway's shared app domain must not receive another app's session cookies.
  if (url.hostname?.endsWith('.up.railway.app')) {
    return url.hostname;
  }
  return url.domain! ? '.' + url.domain! : url.hostname!;
}
