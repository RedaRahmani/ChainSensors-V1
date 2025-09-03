"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Mail, QrCode, Share2, ArrowRight } from "lucide-react";

const BASE =
  process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

function QRimg({ data, size = 200 }: { data: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  return <img src={src} width={size} height={size} alt="QR Code" className="rounded" />;
}

export default function NextStepsClient() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search?.get("order") || "";
  const email = search?.get("email") || "";

  const resumePath = "/seller/devices?step=2";
  const resumeUrl = `${BASE}${resumePath}`;

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Persist locally in case user closes the tab
    try {
      localStorage.setItem("cs_resume_url", resumeUrl);
      if (orderId) localStorage.setItem("cs_order_id", orderId);
    } catch {}
  }, [resumeUrl, orderId]);

  const emailHref = useMemo(() => {
    const subject = "Your ChainSensors device – resume link";
    const body = [
      "Thanks for your purchase!",
      "",
      "When your package arrives, open this link on your phone to finish setup:",
      resumeUrl,
      "",
      "You’ll use the device label values (SSID like CS-XXXXXX and PoP like CS-POP-1234) in the Espressif app.",
    ].join("%0D%0A");
    return `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }, [resumeUrl, email]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Finish device setup", url: resumeUrl, text: "Open this when your device arrives." });
      } else {
        await navigator.clipboard.writeText(resumeUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {}
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          <Card className="border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <Check className="mr-2" /> Payment received
              </CardTitle>
              <CardDescription>
                Your device is being prepared. When it arrives, finish setup using the link below.
                {orderId ? <> (Order <span className="font-mono">{orderId}</span>)</> : null}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <Label>Resume link</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={resumeUrl} />
                  <Button variant="outline" onClick={copy} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={share} title="Share">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <a href={emailHref}>
                    <Button variant="outline" title="Email me this link">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
                {copied && <div className="text-xs text-green-600 mt-1">Copied</div>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Scan this QR on your phone later to open the resume link:
                  </div>
                  <div className="inline-block border rounded p-3 mt-2">
                    <QRimg data={resumeUrl} size={180} />
                  </div>
                </div>
                <div className="text-sm leading-6">
                  <div className="font-medium flex items-center">
                    <QrCode className="h-4 w-4 mr-2" /> What you’ll need when the package arrives
                  </div>
                  <ul className="list-disc ml-5 mt-1">
                    <li>Install <b>ESP SoftAP Provisioning</b> (Espressif) from the app store.</li>
                    <li>Power the device; you’ll see a Wi-Fi network like <b>CS-XXXXXX</b>.</li>
                    <li>Open the resume link above, follow the steps, and use the values on the device label (SSID + PoP).</li>
                  </ul>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>Go to Dashboard</Button>
              <Button onClick={() => router.push("/seller/devices?step=2")}>
                I have the device now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
