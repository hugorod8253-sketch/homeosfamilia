import { lookupBarcode, normalizeBarcode, type LookupResult, type ProductKind } from '../../../lib/barcode-product';

export const runtime = 'nodejs';
// Public product data only. No household identifiers, tickets or private inventory in this cache.
const cache = new Map<string, { until: number; result: LookupResult }>();
const pending = new Map<string, Promise<LookupResult>>();
let windowStart = 0, queries = 0;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = normalizeBarcode(params.get('code') ?? '');
  const kind = params.get('kind');
  if (!code || (kind !== 'food' && kind !== 'beauty'))
    return Response.json({ status: 'invalid', message: 'Revisa el código y el tipo de producto.' }, { status: 400 });
  const key = `${kind}:${code}`, now = Date.now(), hit = cache.get(key);
  if (hit && hit.until > now) return Response.json(hit.result, { headers: { 'Cache-Control':'public, max-age=300' } });
  if (now - windowStart > 60000) { windowStart = now; queries = 0; }
  // Bounds upstream requests in each runtime instance; global provider throttling still applies.
  if (!pending.has(key) && queries >= 60)
    return Response.json({ status:'unavailable', message:'Muchas consultas seguidas. Espera un momento o continúa manualmente.' }, { status:429, headers:{'Retry-After':'60'} });
  let task = pending.get(key);
  if (!task) {
    queries++;
    task = lookupBarcode(code, kind as ProductKind, { userAgent:'HomeOS/2.0 (https://homeosfamilia.vercel.app)' });
    pending.set(key, task);
  }
  const result = await task;
  pending.delete(key);
  if (result.status === 'found' || result.status === 'not-found') {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { until:now + (result.status === 'found' ? 3600000 : 300000), result });
  }
  return Response.json(result, { status:result.status === 'unavailable' ? 503 : 200,
    headers:{'Cache-Control':result.status === 'unavailable' ? 'no-store' : 'public, max-age=300'} });
}
