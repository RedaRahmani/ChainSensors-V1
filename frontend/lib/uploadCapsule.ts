const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3003';

function u8ToB64(u8: Uint8Array) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export async function uploadDekCapsuleFromDekBytes(dek: Uint8Array): Promise<string> {
  if (dek.length !== 32) throw new Error('DEK must be 32 bytes');
  const dekBase64 = u8ToB64(dek);
  const res = await fetch(`${API}/capsules/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dekBase64 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { blobId } = await res.json();
  return blobId as string;
}

export async function uploadDekCapsuleFromBase64(dekBase64: string): Promise<string> {
  const res = await fetch(`${API}/capsules/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dekBase64 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { blobId } = await res.json();
  return blobId as string;
}
