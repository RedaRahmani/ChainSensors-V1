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
  ArrowLeft, Download, Clock, BarChart, ThermometerSun, Droplets, Wind, BarChart3,
} from "lucide-react";
import { RatingModal } from "@/components/rating-modal";
import { RatingDisplay } from "@/components/rating-display";

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
          throw new Error("Unexpected response from purchases endpoint");
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

        setRows(withMeta);
        if (withMeta.length) setSelected(withMeta[0]);
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
    try {
      setBusy("Decrypting…"); setErr(null);

      // Ensure we have dataCid/listing info
      const ensure = async (p: PurchaseRow) => {
        if (p.dataCid && p.listingState != null && p.purchaseIndex != null) return p;
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
      if (!p.dataCid) throw new Error("dataCid missing for this purchase");

      // Load ephemeral secret
      const keyCandidates = [
        `ephSk:${p.listingId}:${p.purchaseIndex}`,
        `ephSk:${p.listingState}:${p.purchaseIndex}`,
        `ephSk:${p.recordPk}:${p.purchaseIndex}`,
        `ephSk:${p.listingId}`,
        `ephSk:${p.listingState}`,
        `ephSk:${p.recordPk}`,
      ].filter(Boolean) as string[];

      const found = keyCandidates.map(k => localStorage.getItem(k)).find(Boolean) || scanAnyEphSk();
      if (!found) {
        throw new Error(`Ephemeral secret not found. Tried: ${keyCandidates.join(" , ")} and an auto-scan of ephSk:*`);
      }
      const ephSk = b64ToU8(found);

      // Buyer capsule
      let buyerCid = p.dekCapsuleForBuyerCid;
      if (!buyerCid) {
        buyerCid = await refreshBuyerCapsule(p);
        if (!buyerCid) throw new Error("Buyer capsule not available yet");
      }

      // Capsule -> DEK
      const capsuleBytes = await fetchBlob(buyerCid);
      const dek = await arc1DecryptCapsuleToDek(ephSk, capsuleBytes);

      // Fetch dataset & decrypt if envelope
      const payload = await fetchJsonOrBytes(p.dataCid);
      let fileBytes: Uint8Array;
      if (payload && typeof payload === "object" && !("byteLength" in payload)) {
        if (Array.isArray(payload)) {
          const parts: Uint8Array[] = [];
          for (const env of payload) parts.push(await decryptEnvelopeWithDek(dek, env));
          const total = parts.reduce((n, u) => n + u.length, 0);
          fileBytes = new Uint8Array(total);
          let off = 0; for (const u of parts) { fileBytes.set(u, off); off += u.length; }
        } else {
          fileBytes = await decryptEnvelopeWithDek(dek, payload);
        }
      } else {
        fileBytes = payload as Uint8Array;
      }

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
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Decrypt failed");
      alert(`Decrypt failed: ${e?.message || "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

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
                          <span>{selected.deviceId || "-"}</span>
                          <span className="mx-2">•</span>
                          <span>{selected.seller || "-"}</span>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Active
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
                        <p className="font-medium">{selected.pricePerUnit ?? "-"} usdc</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Seller</h4>
                        <p className="font-medium">{selected.seller ?? "-"}</p>
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
                        <div className="rounded-lg overflow-hidden border border-primary/20 h-[250px] relative">
                          <div className="absolute inset-0 grid-bg opacity-70"></div>
                          <div className="absolute inset-0 p-4">
                            <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20 h-full overflow-auto">
                              <h4 className="text-sm font-medium mb-2">How to decrypt</h4>
                              <pre className="text-xs font-mono whitespace-pre-wrap">{`We will look for your ephemeral secret in any of these keys:
- localStorage["ephSk:${selected.listingId}:${selected.purchaseIndex}"]
- localStorage["ephSk:${selected.listingState}:${selected.purchaseIndex}"]
- localStorage["ephSk:${selected.recordPk}:${selected.purchaseIndex}"]
- localStorage["ephSk:${selected.listingId}"]  (legacy)
- localStorage["ephSk:${selected.listingState}"] (legacy)
- localStorage["ephSk:${selected.recordPk}"]    (legacy)
- (Auto-scan fallback: any key starting with "ephSk:")

"Decrypt & Download" will fetch:
- Buyer capsule CID: ${selected.dekCapsuleForBuyerCid ?? "(pending via listener)"} (or will poll)
- Data CID: ${selected.dataCid ?? "-"}

Decryption happens locally:
ARC1 (X25519+HKDF+AES-GCM) -> 32B DEK -> decrypt dataset.`}</pre>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button
                            className="flex-1 bg-primary hover:bg-primary/90"
                            disabled={busy !== null}
                            onClick={() => decryptAndDownload(selected)}
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
                        <div className="space-y-2">
                          <Label htmlFor="api-key">Your API Key</Label>
                          <div className="flex">
                            <Input id="api-key" value="(coming soon)" readOnly className="font-mono text-xs" />
                            <Button variant="ghost" size="icon" className="ml-2">📋</Button>
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="text-sm font-medium mb-2">API Endpoint</h4>
                          <code className="text-xs font-mono block p-2 bg-black/20 rounded">
                            https://api.chainsensors.io/v1/data/{selected.listingId ?? ""}
                          </code>
                          <h4 className="text-sm font-medium mt-4 mb-2">Example Request</h4>
                          <pre className="text-xs font-mono p-2 bg-black/20 rounded overflow-x-auto">{`curl -X GET "https://api.chainsensors.io/v1/data/${selected.listingId ?? ""}" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json"`}</pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="transaction" className="space-y-4 pt-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Transaction ID</h4>
                              <p className="font-mono text-xs break-all">{selected.txSignature ?? "-"}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Purchase Date</h4>
                              <p className="font-medium">{formatDate(selected.createdAt)}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Amount</h4>
                              <p className="font-medium">{selected.pricePerUnit ?? "-"} usdc</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                              <p className="text-green-500 font-medium">Confirmed</p>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                if (!selected.txSignature) return;
                                const url = `https://explorer.solana.com/tx/${selected.txSignature}?cluster=devnet`;
                                window.open(url, "_blank");
                              }}
                            >
                              View on Solana Explorer
                            </Button>
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
      </div>
    </main>
  );
}
