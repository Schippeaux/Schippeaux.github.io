// Cloudflare Worker: caches Google Drive photos so visitors don't hit Google directly.
//
//   https://<worker>.workers.dev/<driveFileId>=w2000   (or =h240 etc.)
//
// The first request for a photo/size fetches it from Google Drive; Cloudflare then
// keeps the copy and serves later requests from its cache. Paste this into the
// Worker's code editor in the Cloudflare dashboard and press Deploy.
// The x-cache header shows HIT once a photo is being served from Cloudflare's copy.

const MAX_SIZE = 3000;            // largest width/height the site asks for
const CACHE_SECONDS = 31536000;   // one year: a Drive file ID's content doesn't change

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    const path = new URL(request.url).pathname;
    const m = path.match(/^\/([A-Za-z0-9_-]{20,80})=([wh])(\d{2,4})$/);
    if (!m || +m[3] > MAX_SIZE) {
      return new Response('Not found', { status: 404 });
    }
    const [, id, dim, size] = m;

    const upstream = await fetch(`https://lh3.googleusercontent.com/d/${id}=${dim}${size}`, {
      cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS, cacheTtlByStatus: { '200-299': CACHE_SECONDS, '400-599': 0 } },
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) {
      // Not shared publicly, rate-limited by Google, or missing: don't cache the failure
      return new Response('Photo unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
        'Access-Control-Allow-Origin': '*',
        'x-cache': upstream.headers.get('cf-cache-status') || 'NONE',
      },
    });
  },
};
