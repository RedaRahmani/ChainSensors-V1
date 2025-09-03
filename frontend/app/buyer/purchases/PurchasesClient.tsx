"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { Navbar } from "@/components/navbar";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Download, Clock, BarChart, ThermometerSun, Droplets, Wind, BarChart3, CheckCircle, Shield, Zap, 
  FileText, FileSpreadsheet, Lock, Unlock, Loader2, Activity, MapPin, Wifi, WifiOff, AlertCircle, XCircle, ExternalLink, Database
} from "lucide-react";
import { RatingModal } from "@/components/rating-modal";
import { RatingDisplay } from "@/components/rating-display";
import { newTraceId, felog } from "@/lib/trace";
import { getFakeLocationForDevice } from "@/lib/fake-locations";

// ---------- CONFIG ----------
const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";
const PURCHASES_URLS = (buyer: string) => [
  `${API}/purchases/buyer/${encodeURIComponent(buyer)}`,          // canonical
  `${API}/purchases/by-buyer?buyer=${encodeURIComponent(buyer)}`, // legacy
];
const WALRUS_BLOB = (cid: string) => `${API}/walrus/blobs/${encodeURIComponent(cid)}`;
const DEVICE_META = (deviceId: string) => `${API}/dps/device/${encodeURIComponent(deviceId)}`;

// ---------- TYPES ----------
type PurchaseRow = {
  recordPk: string;
  buyer: string;
  units: number;
  purchaseIndex: number | null;
  createdAt: number | null;
  dekCapsuleForBuyerCid: string | null;
  txSignature: string | null;

  listingState: string | null;
  listingId: string | null;
  deviceId: string | null;
  dataCid: string | null;
  pricePerUnit: number | null;
  expiresAt: number | null;
  seller: string | null;
  deviceMetadata?: any;
};

// ---------- UTILS ----------
function formatDate(isoOrEpoch?: string | number | null) {
  if (isoOrEpoch == null) return "-";
  const d =
    typeof isoOrEpoch === "number" ? new Date(isoOrEpoch * 1000) : new Date(isoOrEpoch);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesGcmDecrypt(keyRaw: Uint8Array, iv: Uint8Array, aad: Uint8Array, ct: Uint8Array, tag: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
  const algo: AesGcmParams = { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 };
  const ctWithTag = new Uint8Array(ct.length + tag.length);
  ctWithTag.set(ct, 0);
  ctWithTag.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt(algo, key, ctWithTag);
  return new Uint8Array(plain);
}

// HKDF-SHA256 to 32 bytes (info = "arcium-seal-dek", empty salt)
async function hkdfSha256(keyMaterial: Uint8Array, infoStr: string): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, ["deriveBits"]);
  const salt = new Uint8Array();
  const info = new TextEncoder().encode(infoStr);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, ikm, 256);
  return new Uint8Array(bits);
}

function inspectArc1Capsule(bytes: Uint8Array) {
  const len = bytes?.length ?? 0;
  if (len < 80) return { ok:false, reason:'capsule_too_short', len };
  // Optional: ARC1 header check if present in your format (keep it conservative):
  // if (!(bytes[0]===0x41 && bytes[1]===0x52 && bytes[2]===0x43 && bytes[3]===0x31)) return { ok:false, reason:'no_arc1_header', len };
  return { ok:true, len };
}

// ARC1 capsule -> 32B DEK
async function arc1DecryptCapsuleToDek(ephSk32: Uint8Array, capsule: Uint8Array): Promise<Uint8Array> {
  if (capsule.length < 4 + 32 + 12 + 16) throw new Error("capsule too short");
  const magic = String.fromCharCode(...capsule.slice(0, 4));
  if (magic !== "ARC1") throw new Error("bad capsule magic");

  const senderEphemeral = capsule.slice(4, 36);
  const iv = capsule.slice(36, 48);
  const tag = capsule.slice(capsule.length - 16);
  const ciphertext = capsule.slice(48, capsule.length - 16);

  const nacl = (await import("tweetnacl")).default;
  if (ephSk32.length !== 32) throw new Error("ephemeral secret must be 32 bytes");
  if (senderEphemeral.length !== 32) throw new Error("sender ephemeral pub must be 32 bytes");
  const shared = nacl.scalarMult(new Uint8Array(ephSk32), new Uint8Array(senderEphemeral));
  const aesKey = await hkdfSha256(shared, "arcium-seal-dek");
  const dek = await aesGcmDecrypt(aesKey, iv, new Uint8Array(0), ciphertext, tag);
  if (dek.length !== 32) throw new Error(`DEK length != 32 (${dek.length})`);
  return dek;
}

async function decryptEnvelopeWithDek(dek: Uint8Array, env: any): Promise<Uint8Array> {
  const iv = b64ToU8(env.iv);
  const tag = b64ToU8(env.tag);
  const aad = env.aad ? b64ToU8(env.aad) : new Uint8Array();
  const ct = b64ToU8(env.ct);
  return aesGcmDecrypt(dek, iv, aad, ct, tag);
}

function pickArray(json: any): any[] | null {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.purchases)) return json.purchases;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.result)) return json.result;
  if (Array.isArray(json.rows)) return json.rows;
  if (json.purchases && Array.isArray(json.purchases.items)) return json.purchases.items;
  return null;
}

// ---------- Friendly display name ----------
const displayName = (p: PurchaseRow) =>
  p?.deviceMetadata?.deviceName || p?.deviceId || p?.listingId || "Listing";

// ---------- Helper functions for improved UI ----------
function getDeviceStatus(purchase: PurchaseRow): { status: string; color: string; icon: string } {
  const now = Date.now() / 1000;
  const isExpired = purchase.expiresAt && purchase.expiresAt < now;
  
  if (isExpired) {
    return { status: "Expired", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: "🔴" };
  }
  
  if (purchase.dekCapsuleForBuyerCid) {
    return { status: "Online", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: "🟢" };
  }
  
  return { status: "Offline", color: "text-orange-500 bg-orange-500/10 border-orange-500/20", icon: "�" };
}

function getDataSourceInfo(purchase: PurchaseRow): string {
  const deviceName = purchase.deviceMetadata?.deviceName || "Unknown Device";
  const location = purchase.deviceMetadata?.location?.city || "Unknown Location";
  return `${deviceName} • ${location}`;
}

function getSellerDisplayName(seller: string | null): string {
  if (!seller) return "ChainSensors Network";
  // Instead of showing the full public key, show a friendly name
  return "Verified Provider";
}

// ---------- API helpers ----------
async function fetchPurchaseMeta(recordPk: string) {
  const res = await fetch(`${API}/purchases/${encodeURIComponent(recordPk)}/meta`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Partial<PurchaseRow> & {
    dataCid: string | null;
    listingId: string | null;
    listingState: string | null;
    purchaseIndex: number | null;
    dekCapsuleForBuyerCid: string | null;
  };
}

async function fetchBlob(cid: string): Promise<Uint8Array> {
  const res = await fetch(WALRUS_BLOB(cid));
  if (!res.ok) throw new Error(await res.text());
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchJsonOrBytes(cid: string): Promise<any | Uint8Array> {
  const res = await fetch(WALRUS_BLOB(cid));
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return new Uint8Array(await res.arrayBuffer());
}

export default function PurchasesClient() {
  const router = useRouter();
  const { connected, userType, publicKey } = useWalletContext();
  const buyer = useMemo(() => (publicKey ? String(publicKey) : ""), [publicKey]);

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [selected, setSelected] = useState<PurchaseRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  
  // Download popup states
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [showOfflineConfirmation, setShowOfflineConfirmation] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [purchaseToRate, setPurchaseToRate] = useState<PurchaseRow | null>(null);
  const [userReviews, setUserReviews] = useState<Record<string, { rating: number; comment: string }>>({});

  // caches / guards
  const metaFetched = useRef<Set<string>>(new Set());           // recordPk we've already asked /meta for
  const ratingsFetched = useRef<Set<string>>(new Set());        // listingIds we already queried
  const abortRef = useRef<AbortController | null>(null);

  function scanAnyEphSk(): string | null {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith("ephSk:")) continue;
      const v = localStorage.getItem(k) || "";
      try {
        const u = b64ToU8(v);
        if (u.length === 32) return v;
      } catch {}
    }
    return null;
  }

  // ---------- Load purchases (base list + device metadata) ----------
  useEffect(() => {
    if (!connected || userType !== "buyer" || !buyer) {
      router.push("/");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        setBusy("Loading purchases…");
        setErr(null);

        let list: PurchaseRow[] | null = null;
        let lastText = "";
        for (const url of PURCHASES_URLS(buyer)) {
          try {
            const res = await fetch(url, { cache: "no-store", signal: ac.signal });
            lastText = await res.text();
            if (!res.ok) continue;
            const json = lastText ? JSON.parse(lastText) : null;
            const arr = pickArray(json);
            if (Array.isArray(arr)) {
              list = arr as PurchaseRow[];
              break;
            }
          } catch {}
        }

        if (!Array.isArray(list)) {
          console.warn("Purchases endpoint returned unexpected shape. Raw:", lastText);
          // Instead of throwing an error, set an empty array and continue
          list = [];
        }

        // Device metadata enrichment
        const deviceIds = Array.from(new Set(list.map(p => p.deviceId).filter(Boolean) as string[]));
        const metaMap = new Map<string, any>();
        if (deviceIds.length) {
          try {
            const metas = await Promise.all(deviceIds.map(async id => {
              try {
                const r = await fetch(DEVICE_META(id), { cache: "no-store", signal: ac.signal });
                if (!r.ok) return { id, meta: null };
                return { id, meta: await r.json() };
              } catch {
                return { id, meta: null };
              }
            }));
            for (const { id, meta } of metas) metaMap.set(id, meta);
          } catch {}
        }

        const withMeta = list.map(p =>
          p.deviceId && !p.deviceMetadata
            ? { ...p, deviceMetadata: metaMap.get(p.deviceId) || null }
            : p
        );

        // Add fake purchases from localStorage
        const fakePurchases = JSON.parse(localStorage.getItem('fakePurchases') || '[]');
        const userFakePurchases = fakePurchases.filter((fp: any) => fp.buyer === buyer);
        
        console.log(`[FAKE] Loading ${userFakePurchases.length} fake purchases for user`);

        // Combine real and fake purchases
        const allPurchases = [...withMeta, ...userFakePurchases];

        setRows(allPurchases);
        if (allPurchases.length) setSelected(allPurchases[0]);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Failed to load purchases");
      } finally {
        setBusy(null);
      }
    })();

    return () => ac.abort();
  }, [connected, userType, buyer, router]);

  // ---------- Backfill missing fields from /purchases/:recordPk/meta (deduped + batched) ----------
  useEffect(() => {
    if (!rows.length) return;

    // Define what "needs meta" means (do NOT require buyer capsule; it often doesn't exist yet)
    const needsFields = (r: PurchaseRow) =>
      !r.dataCid ||
      r.purchaseIndex == null ||
      !r.listingState ||
      r.expiresAt == null ||
      r.pricePerUnit == null ||
      !r.deviceId ||
      !r.seller;

    // choose only records we haven't fetched meta for
    const pending = rows
      .filter(r => needsFields(r) && !metaFetched.current.has(r.recordPk))
      .map(r => r.recordPk);

    if (!pending.length) return;

    // mark as fetched immediately to avoid re-entrancy
    pending.forEach(id => metaFetched.current.add(id));

    let cancelled = false;

    (async () => {
      const batchSize = 3;
      let changed = false;
      const updates = new Map<string, any>();

      for (let i = 0; i < pending.length; i += batchSize) {
        const slice = pending.slice(i, i + batchSize);
        const results = await Promise.allSettled(slice.map(id => fetchPurchaseMeta(id)));
        results.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            updates.set(slice[idx], res.value);
          }
        });
      }

      if (cancelled || !updates.size) return;

      setRows(prev => {
        const next = prev.map(r => {
          const m = updates.get(r.recordPk);
          if (!m) return r;

          const merged = {
            ...r,
            listingId: r.listingId ?? m.listingId ?? null,
            listingState: r.listingState ?? m.listingState ?? null,
            dataCid: r.dataCid ?? m.dataCid ?? null,
            purchaseIndex: r.purchaseIndex ?? m.purchaseIndex ?? null,
            // important: do not force dekCapsuleForBuyerCid; it's okay to stay null
            deviceId: r.deviceId ?? (m as any)?.deviceId ?? null,
            seller: r.seller ?? (m as any)?.seller ?? null,
            pricePerUnit: r.pricePerUnit ?? (m as any)?.pricePerUnit ?? null,
            expiresAt: r.expiresAt ?? (m as any)?.expiresAt ?? null,
          };

          // track if anything actually changed to avoid render loops
          if (JSON.stringify(merged) !== JSON.stringify(r)) changed = true;
          return merged;
        });

        return changed ? next : prev;
      });
    })();

    return () => { cancelled = true; };
  }, [rows]);

  // ---------- Ratings (fetch each listingId once; cache 404s) ----------
  useEffect(() => {
    if (!rows.length || !buyer) return;

    const uniqueIds = Array.from(
      new Set(rows.map(p => p.listingId).filter((x): x is string => !!x))
    );

    const toFetch = uniqueIds.filter(id => !ratingsFetched.current.has(id));
    if (!toFetch.length) return;

    toFetch.forEach(id => ratingsFetched.current.add(id));

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        toFetch.map(async (listingId) => {
          const res = await fetch(`/ratings/listing/${listingId}`);
          if (!res.ok) return { listingId, stats: null as any }; // cache 404/500 as "no stats"
          const stats = (await res.json()) as Array<{ user: string; listing: string; rating: number; comment: string }>;
          return { listingId, stats };
        })
      );

      if (cancelled) return;

      // For each listing, if we have a rating for the current buyer, apply it to all rows with that listingId
      const updates: Record<string, { rating: number; comment: string }> = {};
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { listingId, stats } = r.value;
        if (!stats) continue;
        const mine = stats.find((s) => s.user === buyer);
        if (!mine) continue;
        for (const row of rows) {
          if (row.listingId === listingId) {
            updates[row.recordPk] = { rating: mine.rating, comment: mine.comment };
          }
        }
      }
      if (Object.keys(updates).length) {
        setUserReviews(prev => ({ ...prev, ...updates }));
      }
    })();

    return () => { cancelled = true; };
  }, [rows, buyer]);

  // ---------- Decrypt ----------
  async function refreshBuyerCapsule(p: PurchaseRow): Promise<string | null> {
  const url = `${API}/purchases/${encodeURIComponent(p.recordPk)}/capsule`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(url, { cache: "no-store" });

    // Ready
    if (res.ok) {
      const j = await res.json();
      const cid = j?.dek_capsule_for_buyer_cid ?? j?.dekCapsuleForBuyerCid ?? null;
      if (cid) return cid;
    }

    // Not ready yet – keep polling on 202 (or 425 if you prefer)
    if (res.status === 202 /* || res.status === 425 */) {
      await new Promise(r => setTimeout(r, Math.min(1000 * (attempt + 1), 5000)));
      continue;
    }

    // Hard error or unexpected response
    break;
  }

  return null;
}

  async function decryptAndDownload(p0: PurchaseRow) {
    const traceId = newTraceId();
    
    felog('decrypt.start', {
      traceId,
      recordPk: p0.recordPk,
      hasDataCid: !!p0.dataCid,
      hasBuyerCid: !!p0.dekCapsuleForBuyerCid,
      hasListingState: !!p0.listingState,
      purchaseIndex: p0.purchaseIndex,
    });

    try {
      setBusy("Decrypting…"); setErr(null);

      // Ensure we have dataCid/listing info
      const ensure = async (p: PurchaseRow) => {
        if (p.dataCid && p.listingState != null && p.purchaseIndex != null) return p;
        
        felog('decrypt.ensure_meta', {
          traceId,
          recordPk: p.recordPk,
          needsDataCid: !p.dataCid,
          needsListingState: p.listingState == null,
          needsPurchaseIndex: p.purchaseIndex == null,
        });
        
        const meta = await fetchPurchaseMeta(p.recordPk);
        return {
          ...p,
          listingId: p.listingId ?? meta.listingId ?? null,
          listingState: p.listingState ?? meta.listingState ?? null,
          dataCid: p.dataCid ?? meta.dataCid ?? null,
          purchaseIndex: p.purchaseIndex ?? meta.purchaseIndex ?? null,
          dekCapsuleForBuyerCid: p.dekCapsuleForBuyerCid ?? (meta as any)?.dekCapsuleForBuyerCid ?? (meta as any)?.dek_capsule_for_buyer_cid ?? null,
        };
      };

      const p = await ensure(p0);
      if (!p.dataCid) {
        felog('decrypt.error.no_data_cid', { traceId, recordPk: p.recordPk });
        throw new Error("dataCid missing for this purchase");
      }

      felog('decrypt.meta_resolved', {
        traceId,
        recordPk: p.recordPk,
        dataCid: p.dataCid,
        listingId: p.listingId,
        listingState: p.listingState,
        purchaseIndex: p.purchaseIndex,
        dekCapsuleForBuyerCid: p.dekCapsuleForBuyerCid,
      });

      // Load ephemeral secret
      const keyCandidates = [
        `ephSk:${p.listingId}:${p.purchaseIndex}`,
        `ephSk:${p.listingState}:${p.purchaseIndex}`,
        `ephSk:${p.recordPk}:${p.purchaseIndex}`,
        `ephSk:${p.listingId}`,
        `ephSk:${p.listingState}`,
        `ephSk:${p.recordPk}`,
      ].filter(Boolean) as string[];

      felog('decrypt.ephemeral_lookup', {
        traceId,
        recordPk: p.recordPk,
        keyCandidates,
      });

      const found = keyCandidates.map(k => localStorage.getItem(k)).find(Boolean) || scanAnyEphSk();
      if (!found) {
        felog('decrypt.error.no_ephemeral_secret', {
          traceId,
          recordPk: p.recordPk,
          triedKeys: keyCandidates,
        });
        throw new Error(`Ephemeral secret not found. Tried: ${keyCandidates.join(" , ")} and an auto-scan of ephSk:*`);
      }
      
      const ephSk = b64ToU8(found);
      felog('decrypt.ephemeral_found', {
        traceId,
        recordPk: p.recordPk,
        ephSkLength: ephSk.length,
      });

      // Buyer capsule
      let buyerCid = p.dekCapsuleForBuyerCid;
      if (!buyerCid) {
        felog('decrypt.buyer_capsule_refresh', {
          traceId,
          recordPk: p.recordPk,
        });
        buyerCid = await refreshBuyerCapsule(p);
        if (!buyerCid) {
          felog('decrypt.error.no_buyer_capsule', {
            traceId,
            recordPk: p.recordPk,
          });
          throw new Error("Buyer capsule not available yet");
        }
      }

      felog('decrypt.buyer_capsule_fetch', {
        traceId,
        recordPk: p.recordPk,
        buyerCid,
      });

      // Capsule -> DEK
      const capsuleBytes = await fetchBlob(buyerCid);
      
      // Add pre-decrypt capsule sanity check
      const inspection = inspectArc1Capsule(capsuleBytes);
      if (!inspection.ok) {
        console.debug('[E2E] decrypt:bad_capsule', { reason: inspection.reason, len: inspection.len });
        throw new Error(`Invalid capsule: ${inspection.reason} (length: ${inspection.len} bytes)`);
      }
      
      felog('decrypt.capsule_validation', {
        traceId,
        recordPk: p.recordPk,
        buyerCid,
        capsuleSize: capsuleBytes.length,
        expectedSize: 144,
        isValidSize: capsuleBytes.length === 144,
        isMinimumSize: capsuleBytes.length >= 48,
      });

      if (capsuleBytes.length < 48) {
        felog('decrypt.error.capsule_too_small', {
          traceId,
          recordPk: p.recordPk,
          buyerCid,
          capsuleSize: capsuleBytes.length,
          minimumSize: 48,
        });
        throw new Error(`Buyer capsule too small: ${capsuleBytes.length} bytes (minimum 48 bytes expected)`);
      }

      if (capsuleBytes.length !== 144) {
        felog('decrypt.warning.capsule_size_unexpected', {
          traceId,
          recordPk: p.recordPk,
          buyerCid,
          capsuleSize: capsuleBytes.length,
          expectedSize: 144,
        });
      }

      const dek = await arc1DecryptCapsuleToDek(ephSk, capsuleBytes);
      
      felog('decrypt.dek_extracted', {
        traceId,
        recordPk: p.recordPk,
        dekLength: dek.length,
        expectedDekLength: 32,
      });

      // Fetch dataset & decrypt if envelope
      felog('decrypt.dataset_fetch', {
        traceId,
        recordPk: p.recordPk,
        dataCid: p.dataCid,
      });

      const payload = await fetchJsonOrBytes(p.dataCid);
      let fileBytes: Uint8Array;
      
      if (payload && typeof payload === "object" && !("byteLength" in payload)) {
        if (Array.isArray(payload)) {
          felog('decrypt.envelope_array', {
            traceId,
            recordPk: p.recordPk,
            envelopeCount: payload.length,
          });
          const parts: Uint8Array[] = [];
          for (const env of payload) parts.push(await decryptEnvelopeWithDek(dek, env));
          const total = parts.reduce((n, u) => n + u.length, 0);
          fileBytes = new Uint8Array(total);
          let off = 0; for (const u of parts) { fileBytes.set(u, off); off += u.length; }
        } else {
          felog('decrypt.envelope_single', {
            traceId,
            recordPk: p.recordPk,
          });
          fileBytes = await decryptEnvelopeWithDek(dek, payload);
        }
      } else {
        felog('decrypt.raw_payload', {
          traceId,
          recordPk: p.recordPk,
          payloadSize: (payload as Uint8Array).length,
        });
        fileBytes = payload as Uint8Array;
      }

      felog('decrypt.success', {
        traceId,
        recordPk: p.recordPk,
        finalFileSize: fileBytes.length,
      });

      // Download
      const keyHint = p.listingId || p.listingState || p.recordPk || "dataset";
      const blob = new Blob([fileBytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${keyHint}.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      felog('decrypt.download_complete', {
        traceId,
        recordPk: p.recordPk,
        filename: `${keyHint}.bin`,
      });
    } catch (e: any) {
      felog('decrypt.error', {
        traceId,
        recordPk: p0.recordPk,
        error: e?.message || 'Unknown error',
        errorName: e?.name,
        errorStack: e?.stack,
      });
      
      console.error('[E2E] Decrypt failed:', e);
      setErr(e?.message || "Decrypt failed");
      alert(`Decrypt failed: ${e?.message || "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  // New fake download functions
  const handleDownloadClick = (purchase: PurchaseRow) => {
    setSelected(purchase);
    setShowOfflineConfirmation(true);
    // Show offline confirmation first instead of directly showing download popup
  };

  const downloadFakeData = async (format: 'json' | 'csv') => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadComplete(false);

    // Simulate download progress over 15 seconds
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / 150); // 150 steps for smooth animation
      });
    }, 100);

    // Wait for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Generate fake sensor data directly in code
    let content: string;
    
    if (format === 'json') {
      const jsonData = [
        { timestamp: 8741, temperature: 28.86, humidity: 49.26, pressure: 1015.61, sensor: "BME280", datetime: "2025-09-03T14:30:08.741Z" },
        { timestamp: 10741, temperature: 28.87, humidity: 49.25, pressure: 1015.57, sensor: "BME280", datetime: "2025-09-03T14:30:10.741Z" },
        { timestamp: 12741, temperature: 28.86, humidity: 49.23, pressure: 1015.63, sensor: "BME280", datetime: "2025-09-03T14:30:12.741Z" },
        { timestamp: 14741, temperature: 28.87, humidity: 49.24, pressure: 1015.66, sensor: "BME280", datetime: "2025-09-03T14:30:14.741Z" },
        { timestamp: 16741, temperature: 28.86, humidity: 49.40, pressure: 1015.63, sensor: "BME280", datetime: "2025-09-03T14:30:16.741Z" },
        { timestamp: 18741, temperature: 28.87, humidity: 49.45, pressure: 1015.63, sensor: "BME280", datetime: "2025-09-03T14:30:18.741Z" },
        { timestamp: 20761, temperature: 28.87, humidity: 49.47, pressure: 1015.57, sensor: "BME280", datetime: "2025-09-03T14:30:20.761Z" },
        { timestamp: 22771, temperature: 28.86, humidity: 49.53, pressure: 1015.60, sensor: "BME280", datetime: "2025-09-03T14:30:22.771Z" },
        { timestamp: 24771, temperature: 28.86, humidity: 49.56, pressure: 1015.61, sensor: "BME280", datetime: "2025-09-03T14:30:24.771Z" },
        { timestamp: 26771, temperature: 28.86, humidity: 49.53, pressure: 1015.65, sensor: "BME280", datetime: "2025-09-03T14:30:26.771Z" },
        { timestamp: 28771, temperature: 28.86, humidity: 49.52, pressure: 1015.62, sensor: "BME280", datetime: "2025-09-03T14:30:28.771Z" },
        { timestamp: 30771, temperature: 28.86, humidity: 49.51, pressure: 1015.57, sensor: "BME280", datetime: "2025-09-03T14:30:30.771Z" },
        { timestamp: 32771, temperature: 28.87, humidity: 49.49, pressure: 1015.60, sensor: "BME280", datetime: "2025-09-03T14:30:32.771Z" },
        { timestamp: 34771, temperature: 28.86, humidity: 49.50, pressure: 1015.62, sensor: "BME280", datetime: "2025-09-03T14:30:34.771Z" },
        { timestamp: 36771, temperature: 28.87, humidity: 49.41, pressure: 1015.62, sensor: "BME280", datetime: "2025-09-03T14:30:36.771Z" },
        { timestamp: 38771, temperature: 28.85, humidity: 49.30, pressure: 1015.61, sensor: "BME280", datetime: "2025-09-03T14:30:38.771Z" },
        { timestamp: 40771, temperature: 28.84, humidity: 49.24, pressure: 1015.62, sensor: "BME280", datetime: "2025-09-03T14:30:40.771Z" },
        { timestamp: 42771, temperature: 28.83, humidity: 49.31, pressure: 1015.63, sensor: "BME280", datetime: "2025-09-03T14:30:42.771Z" },
        { timestamp: 44771, temperature: 28.82, humidity: 49.40, pressure: 1015.58, sensor: "BME280", datetime: "2025-09-03T14:30:44.771Z" },
        { timestamp: 46771, temperature: 28.82, humidity: 49.41, pressure: 1015.63, sensor: "BME280", datetime: "2025-09-03T14:30:46.771Z" }
      ];
      content = JSON.stringify(jsonData, null, 2);
    } else {
      content = `timestamp,temperature,humidity,pressure,sensor,datetime
8741,28.86,49.26,1015.61,BME280,2025-09-03T14:30:08.741Z
10741,28.87,49.25,1015.57,BME280,2025-09-03T14:30:10.741Z
12741,28.86,49.23,1015.63,BME280,2025-09-03T14:30:12.741Z
14741,28.87,49.24,1015.66,BME280,2025-09-03T14:30:14.741Z
16741,28.86,49.40,1015.63,BME280,2025-09-03T14:30:16.741Z
18741,28.87,49.45,1015.63,BME280,2025-09-03T14:30:18.741Z
20761,28.87,49.47,1015.57,BME280,2025-09-03T14:30:20.761Z
22771,28.86,49.53,1015.60,BME280,2025-09-03T14:30:22.771Z
24771,28.86,49.56,1015.61,BME280,2025-09-03T14:30:24.771Z
26771,28.86,49.53,1015.65,BME280,2025-09-03T14:30:26.771Z
28771,28.86,49.52,1015.62,BME280,2025-09-03T14:30:28.771Z
30771,28.86,49.51,1015.57,BME280,2025-09-03T14:30:30.771Z
32771,28.87,49.49,1015.60,BME280,2025-09-03T14:30:32.771Z
34771,28.86,49.50,1015.62,BME280,2025-09-03T14:30:34.771Z
36771,28.87,49.41,1015.62,BME280,2025-09-03T14:30:36.771Z
38771,28.85,49.30,1015.61,BME280,2025-09-03T14:30:38.771Z
40771,28.84,49.24,1015.62,BME280,2025-09-03T14:30:40.771Z
42771,28.83,49.31,1015.63,BME280,2025-09-03T14:30:42.771Z
44771,28.82,49.40,1015.58,BME280,2025-09-03T14:30:44.771Z
46771,28.82,49.41,1015.63,BME280,2025-09-03T14:30:46.771Z`;
    }
    
    try {
      const blob = new Blob([content], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sensor-data-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      setDownloadComplete(true);
      
      // Close popup after 2 seconds
      setTimeout(() => {
        setShowDownloadPopup(false);
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadComplete(false);
      }, 2000);
      
    } catch (error) {
      console.error('Download failed:', error);
      setIsDownloading(false);
    }
  };

  const getIcon = (t?: string | null) => {
    switch (t) {
      case "temperature": return <ThermometerSun className="h-5 w-5" />;
      case "humidity": return <Droplets className="h-5 w-5" />;
      case "air-quality": return <Wind className="h-5 w-5" />;
      default: return <BarChart3 className="h-5 w-5" />;
    }
  };

  const handleRate = (p: PurchaseRow) => {
    setPurchaseToRate(p);
    setIsRatingModalOpen(true);
  };

  const handleRatingSubmit = async (rating: number, comment: string) => {
    if (!purchaseToRate) return;
    try {
      const payload = { user: buyer, listing: purchaseToRate.listingId, rating, comment };
      const res = await fetch("/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setUserReviews((prev) => ({ ...prev, [purchaseToRate.recordPk]: { rating, comment } }));
    } catch {
      alert("Could not submit rating.");
    } finally {
      setIsRatingModalOpen(false);
      setPurchaseToRate(null);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/buyer/marketplace")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Marketplace
          </Button>
          <div>
            <h1 className="text-3xl font-bold">My Purchases</h1>
            <p className="text-muted-foreground">Access and manage your purchased data</p>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {busy ? busy : err ? <span className="text-destructive">{err}</span> : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Purchases list */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Your Data Subscriptions</CardTitle>
                  <CardDescription>
                    {rows.length} active subscription{rows.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {rows.map((p) => (
                      <div
                        key={p.recordPk}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selected?.recordPk === p.recordPk ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelected(p)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                            {getIcon(p?.deviceMetadata?.dataTypes?.[0]?.type || null)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{displayName(p)}</h3>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>Expires: {formatDate(p.expiresAt)}</span>
                            </div>
                            {userReviews[p.recordPk] && (
                              <div className="mt-1">
                                <RatingDisplay rating={userReviews[p.recordPk].rating} size="sm" showValue={false} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-2">
                  <Button variant="outline" className="w-full" onClick={() => router.push("/buyer/marketplace")}>
                    Browse More Data
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Details */}
            {selected && (
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{displayName(selected)}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <span>{getDataSourceInfo(selected)}</span>
                          <span className="mx-2">•</span>
                          <span>{getSellerDisplayName(selected.seller)}</span>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getDeviceStatus(selected).color}>
                        <span className="mr-1">{getDeviceStatus(selected).icon}</span>
                        {getDeviceStatus(selected).status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Purchased</h4>
                        <p className="font-medium">{formatDate(selected.createdAt)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Expires</h4>
                        <p className="font-medium">{formatDate(selected.expiresAt)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Price</h4>
                        <p className="font-medium">{selected.pricePerUnit ?? "-"} USDC</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                        <div className="flex items-center">
                          <span className="mr-1">{getDeviceStatus(selected).icon}</span>
                          <p className="font-medium">{getDeviceStatus(selected).status}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="access" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="access">Access Data</TabsTrigger>
                        <TabsTrigger value="api">API Access</TabsTrigger>
                        <TabsTrigger value="transaction">Transaction</TabsTrigger>
                      </TabsList>

                      <TabsContent value="access" className="space-y-4 pt-4">
                        {/* Data Access Status */}
                        <div className="rounded-lg border border-primary/20 p-6 bg-gradient-to-br from-background to-muted/30">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${getDeviceStatus(selected).status === 'Online' ? 'bg-green-500' : getDeviceStatus(selected).status === 'Offline' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                              <div>
                                <h4 className="font-semibold">Data Stream Access</h4>
                                <p className="text-sm text-muted-foreground">
                                  {getDeviceStatus(selected).status === 'Online' ? 'Ready to download encrypted data' :
                                   getDeviceStatus(selected).status === 'Offline' ? 'Device offline - past data available' :
                                   'Data access expired'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className={getDeviceStatus(selected).color}>
                              {getDeviceStatus(selected).status}
                            </Badge>
                          </div>
                          
                          {/* Data Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Data Source:</span>
                                <span className="font-medium">{displayName(selected)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Location:</span>
                                <span className="font-medium">{selected.deviceMetadata?.location?.city || 'Unknown'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Data Type:</span>
                                <span className="font-medium">IoT Sensor Data</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Update Frequency:</span>
                                <span className="font-medium">Real-time</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Access Method:</span>
                                <span className="font-medium">Secure Download</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Data Quality:</span>
                                <span className="font-medium">Premium</span>
                              </div>
                            </div>
                          </div>

                          {/* Security Info */}
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium">Secure Access Protocol</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Your data is encrypted end-to-end using Arcium's secure computation network. 
                              Decryption happens locally in your browser using your private keys.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button
                            className="flex-1 bg-primary hover:bg-primary/90"
                            disabled={busy !== null}
                            onClick={() => handleDownloadClick(selected)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Decrypt & Download
                          </Button>
                          <Button variant="outline" className="flex-1">
                            <BarChart className="mr-2 h-4 w-4" />
                            View Analytics
                          </Button>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant={userReviews[selected.recordPk] ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleRate(selected)}
                          >
                            {userReviews[selected.recordPk] ? "Edit Rating" : "Rate This Data"}
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="api" className="space-y-4 pt-4">
                        <div className="space-y-4">
                          <div className="p-4 bg-muted/30 rounded-lg border">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Real-time API Access</h4>
                              <Badge variant="secondary">Coming Soon</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              Get real-time access to this data stream via our RESTful API. Perfect for integrating 
                              IoT data into your applications and services.
                            </p>
                            
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="api-endpoint" className="text-xs font-medium">API Endpoint</Label>
                                <div className="flex mt-1">
                                  <Input 
                                    id="api-endpoint" 
                                    value={`https://api.chainsensors.io/v1/data/${selected.listingId ?? ""}`}
                                    readOnly 
                                    className="font-mono text-xs bg-muted/50" 
                                  />
                                  <Button variant="ghost" size="icon" className="ml-2 shrink-0">📋</Button>
                                </div>
                              </div>
                              
                              <div>
                                <Label htmlFor="api-key" className="text-xs font-medium">Your API Key</Label>
                                <div className="flex mt-1">
                                  <Input 
                                    id="api-key" 
                                    value="sk-••••••••••••••••••••••••••••••••"
                                    readOnly 
                                    className="font-mono text-xs bg-muted/50" 
                                  />
                                  <Button variant="ghost" size="icon" className="ml-2 shrink-0">�️</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-muted rounded-lg">
                            <h4 className="text-sm font-medium mb-3">Example Usage</h4>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">cURL</Label>
                                <pre className="text-xs font-mono p-3 bg-black/20 rounded overflow-x-auto mt-1">{`curl -X GET "${`https://api.chainsensors.io/v1/data/${selected.listingId ?? ""}`}" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json"`}</pre>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">JavaScript</Label>
                                <pre className="text-xs font-mono p-3 bg-black/20 rounded overflow-x-auto mt-1">{`const response = await fetch('${`https://api.chainsensors.io/v1/data/${selected.listingId ?? ""}`}', {
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json'
  }
});
const data = await response.json();`}</pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="transaction" className="space-y-4 pt-4">
                        <div className="p-4 bg-muted/30 rounded-lg border">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold">Transaction Details</h4>
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              ✓ Confirmed
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Transaction Hash</h4>
                                <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded mt-1">
                                  {selected.txSignature ? `${selected.txSignature.slice(0, 16)}...${selected.txSignature.slice(-16)}` : "-"}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Purchase Date</h4>
                                <p className="font-medium">{formatDate(selected.createdAt)}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Network</h4>
                                <p className="font-medium">Solana Devnet</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Amount Paid</h4>
                                <p className="font-medium text-lg">{selected.pricePerUnit ?? "-"} USDC</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Data Units</h4>
                                <p className="font-medium">{selected.units || 1} unit{(selected.units || 1) > 1 ? 's' : ''}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                  <p className="text-green-500 font-medium">Confirmed</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-6 pt-4 border-t border-border">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  if (!selected.txSignature) return;
                                  const url = `https://explorer.solana.com/tx/${selected.txSignature}?cluster=devnet`;
                                  window.open(url, "_blank");
                                }}
                                disabled={!selected.txSignature}
                              >
                                View on Solana Explorer
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  // Copy transaction hash to clipboard
                                  if (selected.txSignature) {
                                    navigator.clipboard.writeText(selected.txSignature);
                                  }
                                }}
                                disabled={!selected.txSignature}
                              >
                                Copy Transaction Hash
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No purchases yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You haven't purchased any data subscriptions yet. Browse the marketplace to find IoT data.
            </p>
            <Button onClick={() => router.push("/buyer/marketplace")} className="bg-primary hover:bg-primary/90">
              Browse Marketplace
            </Button>
          </div>
        )}

        {purchaseToRate && (
          <RatingModal
            isOpen={isRatingModalOpen}
            onClose={() => setIsRatingModalOpen(false)}
            onSubmit={handleRatingSubmit}
            purchaseTitle={displayName(purchaseToRate)}
            initialRating={userReviews[purchaseToRate.recordPk]?.rating || 0}
            initialComment={userReviews[purchaseToRate.recordPk]?.comment || ""}
          />
        )}

        {/* Offline Confirmation Dialog */}
        {showOfflineConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-md w-full mx-4 transform transition-all duration-300 ease-out scale-100">
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
                    <WifiOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Sensor Offline</h3>
                  <p className="text-muted-foreground">The sensor device is currently offline. You can download previously recorded data from when the device was active.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center space-x-3">
                      <Database className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <div>
                        <h4 className="font-medium text-orange-900 dark:text-orange-100">Historical Data Available</h4>
                        <p className="text-sm text-orange-700 dark:text-orange-300">Access past sensor readings from your purchase period</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowOfflineConfirmation(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setShowOfflineConfirmation(false);
                        setShowDownloadPopup(true);
                      }}
                    >
                      Download Past Data
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Popup Modal */}
        {showDownloadPopup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-md w-full mx-4 transform transition-all duration-300 ease-out scale-100">
              <div className="p-8">
                {!isDownloading && !downloadComplete && (
                  <>
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                        <Download className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">Choose Download Format</h3>
                      <p className="text-muted-foreground">Select your preferred data format for download</p>
                    </div>
                    
                    <div className="space-y-4">
                      <Button 
                        onClick={() => downloadFakeData('json')}
                        className="w-full h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <div className="flex items-center justify-center space-x-3">
                          <FileText className="h-6 w-6" />
                          <div className="text-left">
                            <div className="font-semibold text-lg">JSON Format</div>
                            <div className="text-blue-100 text-sm">Structured data for developers</div>
                          </div>
                        </div>
                      </Button>
                      
                      <Button 
                        onClick={() => downloadFakeData('csv')}
                        className="w-full h-16 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <div className="flex items-center justify-center space-x-3">
                          <FileSpreadsheet className="h-6 w-6" />
                          <div className="text-left">
                            <div className="font-semibold text-lg">CSV Format</div>
                            <div className="text-green-100 text-sm">Spreadsheet compatible</div>
                          </div>
                        </div>
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDownloadPopup(false)}
                      className="w-full mt-6 h-12 border-2 hover:bg-muted/50 transition-colors duration-200"
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {isDownloading && !downloadComplete && (
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6 relative">
                      <Lock className="h-10 w-10 text-primary animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground mb-2">Decrypting & Processing</h3>
                    <p className="text-muted-foreground mb-6">Please wait while we secure your data...</p>
                    
                    <div className="w-full bg-muted/30 rounded-full h-3 mb-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${downloadProgress}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {downloadProgress < 30 && "Authenticating access..."}
                      {downloadProgress >= 30 && downloadProgress < 60 && "Decrypting data streams..."}
                      {downloadProgress >= 60 && downloadProgress < 90 && "Processing sensor data..."}
                      {downloadProgress >= 90 && "Finalizing download..."}
                    </div>
                  </div>
                )}

                {downloadComplete && (
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                      <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground mb-2">Download Complete!</h3>
                    <p className="text-muted-foreground">Your sensor data has been successfully downloaded</p>
                    
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-300">
                        <Unlock className="h-5 w-5" />
                        <span className="font-medium">Data Successfully Decrypted</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
