// backend/src/scripts/walrus-smoke.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const axios = require('axios');

function toBase64Url(s) {
  return String(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function main() {
  const pub = process.env.WALRUS_PUBLISHER_URL;
  const agg = process.env.WALRUS_AGGREGATOR_URL || process.env.WALRUS_URL;
  const epochs = Number(process.env.WALRUS_EPOCHS || '1');
  const deletable = (process.env.WALRUS_DELETABLE || 'false') === 'true';

  if (!pub || !agg) throw new Error('Set WALRUS_PUBLISHER_URL and WALRUS_AGGREGATOR_URL (or WALRUS_URL) in .env');

  const data = Buffer.from(`chainsensors walrus smoke ${Date.now()}`, 'utf8');

  const q = new URLSearchParams();
  q.set('epochs', String(epochs));
  if (deletable) q.set('deletable', 'true');

  const putUrl = `${pub.replace(/\/$/, '')}/v1/blobs?${q.toString()}`;
  console.log('[PUT]', putUrl);

  const putRes = await axios.put(putUrl, data, {
    headers: { 'Content-Type': 'application/octet-stream' },
    validateStatus: s => s >= 200 && s < 300,
    timeout: 60000,
    maxBodyLength: Infinity,
  });

  const body = putRes.data || {};
  const blobId =
    body?.alreadyCertified?.blobId ||
    body?.newlyCreated?.blobObject?.blobId ||
    body?.newlyCreated?.blobId;

  if (!blobId) {
    console.error('Unexpected Walrus publish response:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const raw = String(blobId).trim();
  const b64u = toBase64Url(raw);
  const attempts = [
    { note: 'encoded(raw)', url: `${agg.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(raw)}` },
    { note: 'b64url',       url: `${agg.replace(/\/$/, '')}/v1/blobs/${b64u}` },
    { note: 'encoded(b64u)',url: `${agg.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(b64u)}` },
  ];

  console.log('blobId:', raw);

  let ok = false, got = null, used = null;
  for (const a of attempts) {
    try {
      console.log('[GET]', a.note, a.url);
      const res = await axios.get(a.url, { responseType: 'arraybuffer', timeout: 30000 });
      got = Buffer.from(res.data);
      used = a.note;
      ok = true;
      break;
    } catch (e) {
      console.warn(`GET failed (${a.note}):`, e?.response?.status || e.message);
    }
  }

  if (!ok) {
    console.error('All GET attempts failed');
    process.exit(2);
  }

  console.log('Fetched with:', used);
  console.log('Length:', got.length);
  console.log('Preview:', got.toString('utf8').slice(0, 60));

  console.log('\nSUCCESS: Walrus publisher + aggregator are working.');
  console.log('Now check metrics: cs_walrus_put_total and cs_walrus_get_total should have incremented.');
}

main().catch(e => {
  console.error(e);
  process.exit(99);
});
