"use client";

const API =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3003").replace(/\/$/, "");

/** Update metadata.deviceName for a device */
export function useRenameDevice() {
  return async (deviceId: string, deviceName: string) => {
    const res = await fetch(
      `${API}/dps/device/${encodeURIComponent(deviceId)}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to rename device");
    }
    return res.json();
  };
}
