import { isIP } from 'node:net';

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

function isLanHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.local')) return true;
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized.replace(/^\[|\]$/g, '')) === 6)
    return isPrivateIpv6(normalized);
  return !normalized.includes('.');
}

export function normalizeServerUrl(input) {
  const value = String(input ?? '').trim();
  if (!value) throw new Error('Enter the address of your schwank server.');
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? value
    : `http://${value}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid server address.');
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('The server address must use HTTP or HTTPS.');
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      'Credentials, query parameters, and fragments are not allowed.',
    );
  if (url.pathname !== '/' && url.pathname !== '')
    throw new Error('Use the server origin without an extra path.');
  if (url.protocol === 'http:' && !isLanHostname(url.hostname))
    throw new Error(
      'Public servers must use HTTPS. HTTP is allowed only on a private LAN.',
    );
  if (url.hostname === '0.0.0.0' || url.hostname === '::')
    throw new Error('Use the server’s real LAN address, not a listen address.');
  return url.origin;
}

export function healthEndpoint(serverUrl) {
  return new URL('/api/health', `${normalizeServerUrl(serverUrl)}/`).toString();
}

export function isAllowedApplicationUrl(candidate, serverUrl, setupUrl) {
  try {
    const url = new URL(candidate);
    if (url.href === setupUrl) return true;
    return url.origin === normalizeServerUrl(serverUrl);
  } catch {
    return false;
  }
}
