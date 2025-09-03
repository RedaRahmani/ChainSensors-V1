
// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { PublicKey } from "@solana/web3.js";
// import { Navbar } from "@/components/navbar";
// import { useRegisterDevice } from "@/hooks/useRegisterDevice";
// import { emitReward } from "@/components/sensor";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Slider } from "@/components/ui/slider";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import {
//   ArrowLeft,
//   ArrowRight,
//   Check,
//   Cpu,
//   MapPin,
//   Activity,
//   RotateCw,
// } from "lucide-react";
// import { EnrollMetadata } from "../index";

// const deviceTypes = [
//   { value: "temperature", label: "Temperature Sensor", units: "°C" },
//   { value: "humidity", label: "Humidity Sensor", units: "%" },
//   { value: "air-quality", label: "Air Quality Monitor", units: "µg/m³" },
//   { value: "synthetic_obd_data", label: "Synthetic OBD Data", units: "" },
//   // …add more as needed
// ];

// const dataFrequencies = [
//   { value: "0.016Hz",  label: "Every minute"       },
//   { value: "0.2Hz",    label: "Every 5 minutes"    },
//   { value: "0.066Hz",  label: "Every 15 minutes"   },
//   { value: "0.016Hz",  label: "Every 60 minutes"   }, // duplicate value only matters for key
// ];

// export default function RegisterDeviceClient() {
//   const router = useRouter();
//   const registerDevice = useRegisterDevice();

//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [result, setResult] = useState<{
//     deviceId: string;
//     certificatePem: string;
//     brokerUrl: string;
//     txSignature: string;
//   } | null>(null);

//   // Form state
//   const [csrPem, setCsrPem] = useState("");
//   const [deviceName, setDeviceName] = useState("");
//   const [deviceType, setDeviceType] = useState(deviceTypes[0].value);
//   const [deviceLocation, setDeviceLocation] = useState("");
//   const [latitude, setLatitude] = useState<number>(0);
//   const [longitude, setLongitude] = useState<number>(0);
//   const [dataFrequency, setDataFrequency] = useState(dataFrequencies[0].value);
//   const [dataAccuracy, setDataAccuracy] = useState<number[]>([90]);

//   const next = () => setStep((s) => Math.min(4, s + 1));
//   const back = () => setStep((s) => Math.max(1, s - 1));

//   const handleRegister = async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const metadata: EnrollMetadata = {
//         deviceName,
//         model: deviceType,
//         location: { latitude, longitude },
//         dataTypes: [{
//           type: deviceType,
//           units: deviceTypes.find((t) => t.value === deviceType)?.units || "",
//           frequency: dataFrequency,
//         }],
//         pricePerUnit: 1,
//         totalDataUnits: dataAccuracy[0] * 10,
//       };

//       const res = await registerDevice(csrPem, metadata);
//       setResult(res);
//       setStep(5);
      
//       // Emit reward animation for successful device registration
//       emitReward(100); // 100 SENSOR tokens reward
//     } catch (err: any) {
//       console.error(err);
//       setError(err.message || "Registration failed");
//     } finally {
//       setLoading(false);
//     }
//   };
//   // Success view
//   if (step === 5 && result) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16">
//           <Card className="max-w-3xl mx-auto">
//             <CardHeader>
//               <CardTitle className="flex items-center text-green-600">
//                 <Check className="mr-2" /> Device Registered
//               </CardTitle>
//               <CardDescription>
//                 On-chain tx: <code>{result.txSignature}</code>
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <div>
//                 <h4 className="font-medium">Certificate PEM</h4>
//                 <pre className="p-4 bg-gray-400 text-green-200 rounded overflow-auto text-sm font-mono whitespace-pre-wrap">
//                   <code>{result.certificatePem}</code>
//                 </pre>
//               </div>
//               <div>
//                 <h4 className="font-medium">MQTT Broker URL</h4>
//                 <p>{result.brokerUrl}</p>
//               </div>
//               <div>
//                 <h4 className="font-medium">Device ID</h4>
//                 <p>{result.deviceId}</p>
//               </div>
//             </CardContent>
//             <CardFooter>
//               <Button onClick={() => router.push("/seller/dashboard")}>
//                 Back to Dashboard
//               </Button>
//             </CardFooter>
//           </Card>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />
//       <div className="container mx-auto px-4 pt-24 pb-16">
//         {/* Header & Progress */}
//         <div className="flex items-center mb-8">
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={() => router.push("/seller/dashboard")}
//             className="mr-4"
//           >
//             <ArrowLeft className="h-4 w-4 mr-2" /> Back
//           </Button>
//           <div>
//             <h1 className="text-3xl font-bold">Register IoT Device</h1>
//             <p className="text-muted-foreground">Step {step} of 4</p>
//           </div>
//         </div>

//         {/* Steps */}
//         <div className="max-w-3xl mx-auto space-y-8">
//           {step === 1 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Cpu className="mr-2" /> Basic Info
//                 </CardTitle>
//                 <CardDescription>Paste your CSR and device details</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div>
//                   <Label>CSR (PEM)</Label>
//                   <textarea
//                     rows={6}
//                     className="w-full p-2 border rounded"
//                     value={csrPem}
//                     onChange={(e) => setCsrPem(e.target.value)}
//                     placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
//                     required
//                   />
//                 </div>
//                 <div>
//                   <Label>Device Name</Label>
//                   <Input
//                     value={deviceName}
//                     onChange={(e) => setDeviceName(e.target.value)}
//                     placeholder="Air Sensor #1"
//                   />
//                 </div>
//                 <div>
//                   <Label>Device Type</Label>
//                   <Select value={deviceType} onValueChange={setDeviceType}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Type" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {deviceTypes.map((t) => (
//                         <SelectItem key={t.value} value={t.value}>
//                           {t.label}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button
//                   variant="outline"
//                   onClick={() => router.push("/seller/dashboard")}
//                 >
//                   Cancel
//                 </Button>
//                 <Button onClick={next} disabled={!csrPem || !deviceName}>
//                   Next
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {step === 2 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <MapPin className="mr-2" /> Location
//                 </CardTitle>
//                 <CardDescription>Where is your device?</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div>
//                   <Label>Location Description</Label>
//                   <Input
//                     value={deviceLocation}
//                     onChange={(e) => setDeviceLocation(e.target.value)}
//                     placeholder="Rooftop"
//                   />
//                 </div>
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <Label>Latitude</Label>
//                     <Input
//                       type="number"
//                       step="any"
//                       value={latitude}
//                       onChange={(e) => setLatitude(parseFloat(e.target.value))}
//                     />
//                   </div>
//                   <div>
//                     <Label>Longitude</Label>
//                     <Input
//                       type="number"
//                       step="any"
//                       value={longitude}
//                       onChange={(e) => setLongitude(parseFloat(e.target.value))}
//                     />
//                   </div>
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>
//                   Back
//                 </Button>
//                 <Button onClick={next} disabled={!deviceLocation}>
//                   Next
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {step === 3 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Activity className="mr-2" /> Data Specs
//                 </CardTitle>
//                 <CardDescription>Configure frequency & accuracy</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div>
//                   <Label>Frequency</Label>
//                   <Select value={dataFrequency} onValueChange={setDataFrequency}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Frequency" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {dataFrequencies.map((f, i) => (
//                       // use `i` as the key so React can differentiate them
//                       <SelectItem key={i} value={f.value}>
//                         {f.label}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//                 <div>
//                   <Label>Accuracy (%)</Label>
//                   <Slider
//                     min={50}
//                     max={100}
//                     value={dataAccuracy}
//                     onValueChange={setDataAccuracy}
//                   />
//                   <div className="text-sm mt-1">{dataAccuracy[0]}%</div>
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>
//                   Back
//                 </Button>
//                 <Button onClick={next}>Next</Button>
//               </CardFooter>
//             </Card>
//           )}

//           {step === 4 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Check className="mr-2" /> Confirm
//                 </CardTitle>
//                 <CardDescription>Review and register</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <h4 className="font-medium">Name:</h4>
//                 <p>{deviceName}</p>
//                 <h4 className="font-medium">Type:</h4>
//                 <p>{deviceTypes.find((t) => t.value === deviceType)?.label}</p>
//                 <h4 className="font-medium">Location:</h4>
//                 <p>
//                   {deviceLocation} ({latitude}, {longitude})
//                 </p>
//                 <h4 className="font-medium">Frequency:</h4>
//                 <p>{dataFrequency}</p>
//                 <h4 className="font-medium">Accuracy:</h4>
//                 <p>{dataAccuracy[0]}%</p>
//                 {error && <p className="text-red-600">{error}</p>}
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>
//                   Back
//                 </Button>
//                 <Button onClick={handleRegister} disabled={loading}>
//                   {loading ? (
//                     <>
//                       <RotateCw className="animate-spin mr-2" />
//                       Registering…
//                     </>
//                   ) : (
//                     "Register Device"
//                   )}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}
//         </div>
//       </div>
//     </main>
//   );
// }








// "use client";

// import { useEffect, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Navbar } from "@/components/navbar";
// import { useWallet } from "@solana/wallet-adapter-react";
// import { usePayToStart } from "@/hooks/usePayToStart";
// import { useClaimDevice } from "@/hooks/useClaimDevice";
// import { Button } from "@/components/ui/button";
// import {
//   Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
// import {
//   ArrowLeft, Check, MapPin, Phone, Mail, User, Wifi, QrCode, ShieldCheck, RotateCw, CreditCard,
// } from "lucide-react";

// const PUBLIC_BASE =
//   process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
//   (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

// function QRimg({ data, size = 180 }: { data: string; size?: number }) {
//   const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
//     data
//   )}`;
//   return <img src={src} width={size} height={size} alt="QR Code" className="rounded" />;
// }

// export default function RegisterDeviceClient() {
//   const router = useRouter();
//   const search = useSearchParams();
//   const { publicKey } = useWallet();
//   const payToStart = usePayToStart();
//   const claimDevice = useClaimDevice();

//   const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
//   const next = () => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
//   const back = () => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);

//   // step 1 – contact + pay
//   const [fullName, setFullName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [address, setAddress] = useState("");
//   const [paying, setPaying] = useState(false);
//   const [payError, setPayError] = useState<string | null>(null);
//   const [txSig, setTxSig] = useState<string | null>(null);

//   // step 3 – claim
//   const [deviceId, setDeviceId] = useState("");
//   const [claimCode, setClaimCode] = useState("");
//   const [claimLoading, setClaimLoading] = useState(false);
//   const [claimError, setClaimError] = useState<string | null>(null);
//   const [claimed, setClaimed] = useState(false);

//   // prefill if opened from QR like ?dev=...&code=...
//   useEffect(() => {
//     if (!search) return;
//     const dev = search.get("dev");
//     const code = search.get("code");
//     if (dev) setDeviceId(dev);
//     if (code) setClaimCode(code);
//   }, [search]);

//   const handlePay = async () => {
//     setPaying(true);
//     setPayError(null);
//     try {
//       const { txSignature } = await payToStart({
//         fullName, email, phone, address,
//       });
//       setTxSig(txSignature);
//       next();
//     } catch (e: any) {
//       setPayError(e?.message || "Payment failed");
//     } finally {
//       setPaying(false);
//     }
//   };

//   const handleClaim = async () => {
//     setClaimLoading(true);
//     setClaimError(null);
//     try {
//       if (!deviceId || !claimCode) throw new Error("Device ID and code are required");
//       await claimDevice(deviceId.trim(), claimCode.trim());
//       setClaimed(true);
//       setStep(4);
//       setTimeout(() => router.push("/seller/dashboard"), 1500);
//     } catch (e: any) {
//       setClaimError(e?.message || "Claim failed");
//     } finally {
//       setClaimLoading(false);
//     }
//   };

//   const Header = (
//     <div className="flex items-center mb-8">
//       <Button
//         variant="ghost"
//         size="sm"
//         onClick={() => router.push("/seller/dashboard")}
//         className="mr-4"
//       >
//         <ArrowLeft className="h-4 w-4 mr-2" /> Back
//       </Button>
//       <div>
//         <h1 className="text-3xl font-bold">Add a Device</h1>
//         <p className="text-muted-foreground">Step {step} of 4</p>
//       </div>
//     </div>
//   );

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />
//       <div className="container mx-auto px-4 pt-24 pb-16">
//         {Header}

//         <div className="max-w-3xl mx-auto space-y-8">
//           {/* STEP 1: contact + pay */}
//           {step === 1 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <User className="mr-2" /> Contact & Shipping
//                 </CardTitle>
//                 <CardDescription>
//                   We’ll ship your pre-configured ESP to this address. You’ll confirm with a small on-chain payment.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue.
//                   </p>
//                 )}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Full name</Label>
//                     <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
//                   </div>
//                   <div>
//                     <Label>Phone</Label>
//                     <div className="flex items-center gap-2">
//                       <Phone className="h-4 w-4 text-muted-foreground" />
//                       <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
//                     </div>
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Email</Label>
//                   <div className="flex items-center gap-2">
//                     <Mail className="h-4 w-4 text-muted-foreground" />
//                     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Shipping address</Label>
//                   <div className="flex items-center gap-2">
//                     <MapPin className="h-4 w-4 text-muted-foreground" />
//                     <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Market St, City, Country" />
//                   </div>
//                 </div>
//                 {payError && <p className="text-red-600 text-sm">{payError}</p>}
//                 {txSig && (
//                   <p className="text-xs text-muted-foreground">
//                     Payment confirmed: <span className="font-mono">{txSig}</span>
//                   </p>
//                 )}
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={handlePay}
//                   disabled={!publicKey || paying || !fullName || !email || !address}
//                 >
//                   {paying ? (
//                     <>
//                       <RotateCw className="animate-spin mr-2" />
//                       Confirm & Pay
//                     </>
//                   ) : (
//                     <>
//                       Confirm & Pay <CreditCard className="ml-2 h-4 w-4" />
//                     </>
//                   )}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 2: provisioning instructions */}
//           {step === 2 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Wifi className="mr-2" /> Connect your device to Wi-Fi
//                 </CardTitle>
//                 <CardDescription>
//                   After you receive the device, use the official Espressif mobile app to provision via SoftAP.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4 text-sm leading-6">
//                 <ol className="list-decimal ml-5 space-y-2">
//                   <li>Plug in the device and wait for Wi-Fi <strong>CS-XXXX</strong> to appear.</li>
//                   <li>
//                     Open Espressif’s <em>ESP SoftAP Provisioning</em> app (iOS/Android). Tap <strong>Scan QR</strong> on the box label,
//                     or press <strong>“I don’t have a QR code”</strong> and enter:
//                     <div className="mt-2 p-3 rounded bg-muted font-mono text-xs">
//                       SSID: <b>CS-XXXX</b> (printed on label)<br />
//                       PoP: <b>CS-POP-1234</b> (printed on label)
//                     </div>
//                   </li>
//                   <li>Enter your Wi-Fi SSID + password and finish.</li>
//                   <li>The device fetches its certificate and connects securely; you’ll be able to claim it next.</li>
//                 </ol>
//                 <Separator className="my-4" />
//                 <div className="text-muted-foreground">
//                   FYI: The provisioning QR contains <code>{"{ver,name,pop,transport}"}</code> that the Espressif app understands.
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>Back</Button>
//                 <Button onClick={next}>Continue to Claim</Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 3: claim */}
//           {step === 3 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <QrCode className="mr-2" /> Claim your device
//                 </CardTitle>
//                 <CardDescription>
//                   Bind the device to your wallet. Scan the claim QR (opens this page prefilled), or type manually.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue. (We need your public key for the claim.)
//                   </p>
//                 )}
//                 <div>
//                   <Label>Device ID</Label>
//                   <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="cs-xxxxxxxxxxxx" />
//                 </div>
//                 <div>
//                   <Label>Claim code (6 digits)</Label>
//                   <Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="821188" />
//                 </div>
//                 {deviceId && claimCode && (
//                   <div className="mt-2">
//                     <Label>Optional: claim link (QR)</Label>
//                     <div className="p-3 border rounded inline-block">
//                       <QRimg
//                         data={`${PUBLIC_BASE}/seller/devices?dev=${encodeURIComponent(
//                           deviceId
//                         )}&code=${encodeURIComponent(claimCode)}`}
//                         size={176}
//                       />
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Scan this on another device to open this page prefilled.
//                     </p>
//                   </div>
//                 )}
//                 {claimError && <p className="text-red-600 text-sm">{claimError}</p>}
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>Back</Button>
//                 <Button onClick={handleClaim} disabled={!publicKey || claimLoading || !deviceId || !claimCode}>
//                   {claimLoading ? (<><RotateCw className="animate-spin mr-2" /> Claiming…</>) : (<>Claim <ShieldCheck className="ml-2 h-4 w-4" /></>)}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 4: success */}
//           {step === 4 && claimed && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center text-green-600">
//                   <Check className="mr-2" /> Device claimed
//                 </CardTitle>
//                 <CardDescription>
//                   <span className="font-mono">{deviceId}</span> is now linked to your account.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <p>You’ll start seeing live readings in your dashboard within a minute.</p>
//               </CardContent>
//               <CardFooter>
//                 <Button onClick={() => router.push("/seller/dashboard")}>Go to Dashboard</Button>
//               </CardFooter>
//             </Card>
//           )}
//         </div>
//       </div>
//     </main>
//   );
// }












// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Navbar } from "@/components/navbar";
// import { useWallet } from "@solana/wallet-adapter-react";
// import { usePayToStart } from "@/hooks/usePayToStart";
// import { useClaimDevice } from "@/hooks/useClaimDevice";
// import { Button } from "@/components/ui/button";
// import {
//   Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
// import {
//   ArrowLeft, Check, MapPin, Phone, Mail, User, Wifi, QrCode, ShieldCheck, RotateCw, CreditCard, ExternalLink,
// } from "lucide-react";

// const PUBLIC_BASE =
//   process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
//   (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

// function QRimg({ data, size = 180 }: { data: string; size?: number }) {
//   const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
//     data
//   )}`;
//   return <img src={src} width={size} height={size} alt="QR Code" className="rounded" />;
// }

// // Espressif SoftAP provisioning QR payload
// function makeEspressifProvisionQR(name: string, pop: string) {
//   return JSON.stringify({ ver: "v1", name, pop, transport: "softap" });
// }

// export default function RegisterDeviceClient() {
//   const router = useRouter();
//   const search = useSearchParams();
//   const { publicKey } = useWallet();
//   const payToStart = usePayToStart();
//   const claimDevice = useClaimDevice();

//   const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
//   const next = () => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
//   const back = () => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);

//   // Allow resuming via ?step=2 or ?step=3
//   useEffect(() => {
//     if (!search) return;
//     const s = Number(search.get("step") || "0");
//     if (s >= 1 && s <= 4) setStep(s as 1 | 2 | 3 | 4);
//   }, [search]);

//   // step 1 – contact + pay
//   const [fullName, setFullName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [address, setAddress] = useState("");
//   const [paying, setPaying] = useState(false);
//   const [payError, setPayError] = useState<string | null>(null);
//   const [txSig, setTxSig] = useState<string | null>(null);

//   // step 2 – provisioning values (from box label)
//   const [ssid, setSsid] = useState("");     // e.g. CS-6FE1A9
//   const [pop, setPop] = useState("");       // e.g. CS-POP-1234

//   // step 3 – claim (use Device ID = SSID; claim code = PoP)
//   const [deviceId, setDeviceId] = useState("");
//   const [claimCode, setClaimCode] = useState("");
//   const [claimLoading, setClaimLoading] = useState(false);
//   const [claimError, setClaimError] = useState<string | null>(null);
//   const [claimed, setClaimed] = useState(false);

//   // auto-claim state
//   const triedAuto = useRef(false);
//   const retryTimer = useRef<NodeJS.Timeout | null>(null);
//   const retryCount = useRef(0);

//   // Prefill device+code from URL (?dev=...&code=...) OR from step2 fields
//   useEffect(() => {
//     if (!search) return;
//     const dev = search.get("dev");
//     const code = search.get("code");
//     if (dev) setDeviceId(dev);
//     if (code) setClaimCode(code);
//   }, [search]);

//   useEffect(() => {
//     if (!deviceId && ssid) setDeviceId(ssid);
//     if (!claimCode && pop) setClaimCode(pop);
//   }, [ssid, pop]); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     // Auto-claim if we land on step=3 with everything present
//     if (step !== 3) return;
//     if (triedAuto.current) return;
//     if (!publicKey || !deviceId || !claimCode) return;
//     triedAuto.current = true;
//     void handleClaim(true);
//   }, [step, publicKey, deviceId, claimCode]); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
//   }, []);

//   const handlePay = async () => {
//     setPaying(true);
//     setPayError(null);
//     try {
//       const { txSignature } = await payToStart({ fullName, email, phone, address });
//       setTxSig(txSignature);
//       setStep(2); // show provisioning; user can leave and come back with ?step=2
//     } catch (e: any) {
//       setPayError(e?.message || "Payment failed");
//     } finally {
//       setPaying(false);
//     }
//   };

//   const handleClaim = async (fromAuto = false) => {
//     if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
//     setClaimLoading(true);
//     setClaimError(fromAuto ? "Checking device registration..." : null);

//     try {
//       if (!deviceId || !claimCode) throw new Error("Device ID and PoP are required");
//       await claimDevice(deviceId.trim(), claimCode.trim()); // claimCode = PoP
//       setClaimed(true);
//       setStep(4);
//       // Add a small delay so the success card is visible, then go to dashboard
//       setTimeout(() => router.push(`/seller/dashboard?claimed=1&device=${encodeURIComponent(deviceId)}`), 900);
//     } catch (e: any) {
//       const msg = String(e?.message || "");
//       const isAuth = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
//       if (isAuth) {
//         // Auto-retry for up to ~2 minutes while user waits for the device to call /dps/bootstrap
//         if (retryCount.current < 24) {
//           retryCount.current += 1;
//           setClaimError("Waiting for device to finish setup… retrying automatically.");
//           retryTimer.current = setTimeout(() => void handleClaim(true), 5000);
//         } else {
//           setClaimError("Still not ready. Ensure the ESP finished provisioning and try again.");
//         }
//       } else {
//         setClaimError(msg || "Claim failed");
//       }
//     } finally {
//       setClaimLoading(false);
//     }
//   };

//   const provisionQR = useMemo(() => {
//     if (!ssid || !pop) return "";
//     return makeEspressifProvisionQR(ssid.trim(), pop.trim());
//   }, [ssid, pop]);

//   const claimPrefillQR = useMemo(() => {
//     if (!deviceId || !claimCode) return "";
//     return `${PUBLIC_BASE}/seller/devices?dev=${encodeURIComponent(deviceId)}&code=${encodeURIComponent(claimCode)}&step=3`;
//   }, [deviceId, claimCode]);

//   const Header = (
//     <div className="flex items-center mb-8">
//       <Button
//         variant="ghost"
//         size="sm"
//         onClick={() => router.push("/seller/dashboard")}
//         className="mr-4"
//       >
//         <ArrowLeft className="h-4 w-4 mr-2" /> Back
//       </Button>
//       <div>
//         <h1 className="text-3xl font-bold">Add a Device</h1>
//         <p className="text-muted-foreground">Step {step} of 4</p>
//       </div>
//     </div>
//   );

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />
//       <div className="container mx-auto px-4 pt-24 pb-16">
//         {Header}

//         <div className="max-w-3xl mx-auto space-y-8">
//           {/* STEP 1: contact + pay */}
//           {step === 1 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <User className="mr-2" /> Contact & Shipping
//                 </CardTitle>
//                 <CardDescription>
//                   We’ll ship your pre-configured ESP to this address. Confirm with a small on-chain payment.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue.
//                   </p>
//                 )}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Full name</Label>
//                     <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
//                   </div>
//                   <div>
//                     <Label>Phone</Label>
//                     <div className="flex items-center gap-2">
//                       <Phone className="h-4 w-4 text-muted-foreground" />
//                       <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
//                     </div>
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Email</Label>
//                   <div className="flex items-center gap-2">
//                     <Mail className="h-4 w-4 text-muted-foreground" />
//                     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Shipping address</Label>
//                   <div className="flex items-center gap-2">
//                     <MapPin className="h-4 w-4 text-muted-foreground" />
//                     <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Market St, City, Country" />
//                   </div>
//                 </div>
//                 {payError && <p className="text-red-600 text-sm">{payError}</p>}
//                 {txSig && (
//                   <p className="text-xs text-muted-foreground">
//                     Payment confirmed: <span className="font-mono">{txSig}</span>
//                   </p>
//                 )}
//               </CardContent>
//               <CardFooter className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2 md:justify-between">
//                 <div className="text-xs text-muted-foreground">
//                   You can come back later using this link:{" "}
//                   <a className="underline" href={`${PUBLIC_BASE}/seller/devices?step=2`}>{`${PUBLIC_BASE}/seller/devices?step=2`}</a>
//                 </div>
//                 <div className="flex gap-2 w-full md:w-auto">
//                   <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
//                     Cancel
//                   </Button>
//                   <Button
//                     onClick={handlePay}
//                     disabled={!publicKey || paying || !fullName || !email || !address}
//                   >
//                     {paying ? (
//                       <>
//                         <RotateCw className="animate-spin mr-2" />
//                         Confirm & Pay
//                       </>
//                     ) : (
//                       <>
//                         Confirm & Pay <CreditCard className="ml-2 h-4 w-4" />
//                       </>
//                     )}
//                   </Button>
//                 </div>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 2: provisioning instructions + real Espressif QR */}
//           {step === 2 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Wifi className="mr-2" /> Connect your device to Wi-Fi
//                 </CardTitle>
//                 <CardDescription>
//                   When your package arrives, power the ESP and use Espressif’s mobile app to provision via SoftAP.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-5 text-sm leading-6">
//                 <ol className="list-decimal ml-5 space-y-2">
//                   <li>Plug in the device. A Wi-Fi network like <b>CS-XXXXXX</b> will appear.</li>
//                   <li>
//                     Open Espressif’s <b>ESP SoftAP Provisioning</b> app (iOS/Android).
//                     You can scan the QR below or choose “I don’t have a QR code” and type the values from the label.
//                   </li>
//                 </ol>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Device SSID (from label)</Label>
//                     <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="CS-6FE1A9" />
//                   </div>
//                   <div>
//                     <Label>PoP (from label)</Label>
//                     <Input value={pop} onChange={(e) => setPop(e.target.value)} placeholder="CS-POP-1234" />
//                   </div>
//                 </div>

//                 {ssid && pop && (
//                   <>
//                     <Separator className="my-2" />
//                     <div>
//                       <Label>Provisioning QR (scan with Espressif app)</Label>
//                       <div className="p-3 border rounded inline-block">
//                         <QRimg data={makeEspressifProvisionQR(ssid.trim(), pop.trim())} size={200} />
//                       </div>
//                       <p className="text-xs text-muted-foreground mt-2">
//                         Contains: <code className="font-mono">{"{ver,name,pop,transport:\"softap\"}"}</code>
//                       </p>
//                     </div>
//                   </>
//                 )}

//                 <Separator className="my-4" />
//                 <div className="text-muted-foreground">
//                   After Wi-Fi is set, the device will fetch its certificate and call our backend to “bootstrap”.
//                   Then you can claim it to your wallet.
//                 </div>
//               </CardContent>
//               <CardFooter className="flex flex-wrap gap-2 justify-between">
//                 <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
//                 <div className="flex gap-2">
//                   <Button variant="secondary" onClick={() => router.push("/seller/dashboard")}>
//                     I’ll finish later
//                   </Button>
//                   <Button onClick={() => {
//                     setDeviceId(ssid.trim());
//                     setClaimCode(pop.trim());
//                     setStep(3);
//                   }}>
//                     Continue to Claim <ExternalLink className="ml-2 h-4 w-4" />
//                   </Button>
//                 </div>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 3: claim (code = PoP) */}
//           {step === 3 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <QrCode className="mr-2" /> Claim your device
//                 </CardTitle>
//                 <CardDescription>
//                   Bind the device to your wallet. Use the same <b>PoP</b> you used in the Espressif app.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue. (We need your public key for the claim.)
//                   </p>
//                 )}
//                 <div>
//                   <Label>Device ID</Label>
//                   <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="CS-6FE1A9" />
//                 </div>
//                 <div>
//                   <Label>Claim code (same as PoP)</Label>
//                   <Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="CS-POP-1234" />
//                   <p className="text-xs text-muted-foreground mt-1">
//                     Tip: Must match the PoP you entered during provisioning.
//                   </p>
//                 </div>

//                 {deviceId && claimCode && (
//                   <div className="mt-2">
//                     <Label>Optional: resume link (QR)</Label>
//                     <div className="p-3 border rounded inline-block">
//                       <QRimg data={claimPrefillQR} size={176} />
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Scan on another device to open this page prefilled.
//                     </p>
//                   </div>
//                 )}

//                 {claimError && <p className="text-red-600 text-sm">{claimError}</p>}
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>Back</Button>
//                 <Button onClick={() => void handleClaim()} disabled={!publicKey || claimLoading || !deviceId || !claimCode}>
//                   {claimLoading ? (<><RotateCw className="animate-spin mr-2" /> Checking…</>) : (<>Claim <ShieldCheck className="ml-2 h-4 w-4" /></>)}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 4: success */}
//           {step === 4 && claimed && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center text-green-600">
//                   <Check className="mr-2" /> Device claimed
//                 </CardTitle>
//                 <CardDescription>
//                   <span className="font-mono">{deviceId}</span> is now linked to your account.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <p>You’ll start seeing live readings in your dashboard within a minute.</p>
//               </CardContent>
//               <CardFooter>
//                 <Button onClick={() => router.push("/seller/dashboard")}>Go to Dashboard</Button>
//               </CardFooter>
//             </Card>
//           )}
//         </div>
//       </div>
//     </main>
//   );
// }


















// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Navbar } from "@/components/navbar";
// import { useWallet } from "@solana/wallet-adapter-react";
// import { usePayToStart } from "@/hooks/usePayToStart";
// import { useClaimDevice } from "@/hooks/useClaimDevice";
// import { useRenameDevice } from "@/hooks/useRenameDevice";
// import { Button } from "@/components/ui/button";
// import {
//   Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
// import {
//   ArrowLeft, Check, MapPin, Phone, Mail, User, Wifi, QrCode, ShieldCheck, RotateCw, CreditCard, ExternalLink, Download,
// } from "lucide-react";

// const PUBLIC_BASE =
//   process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
//   (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

// function QRimg({ data, size = 180 }: { data: string; size?: number }) {
//   const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
//     data
//   )}`;
//   return <img src={src} width={size} height={size} alt="QR Code" className="rounded" />;
// }

// // Espressif SoftAP provisioning QR payload
// function makeEspressifProvisionQR(name: string, pop: string) {
//   return JSON.stringify({ ver: "v1", name, pop, transport: "softap" });
// }

// export default function RegisterDeviceClient() {
//   const router = useRouter();
//   const search = useSearchParams();
//   const { publicKey } = useWallet();
//   const payToStart = usePayToStart();
//   const claimDevice = useClaimDevice();
//   const renameDevice = useRenameDevice();

//   const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
//   const next = () => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
//   const back = () => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);

//   // Allow resuming via ?step=2 or ?step=3
//   useEffect(() => {
//     if (!search) return;
//     const s = Number(search.get("step") || "0");
//     if (s >= 1 && s <= 4) setStep(s as 1 | 2 | 3 | 4);
//   }, [search]);

//   // step 1 – contact + pay
//   const [fullName, setFullName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [address, setAddress] = useState("");
//   const [paying, setPaying] = useState(false);
//   const [payError, setPayError] = useState<string | null>(null);
//   const [txSig, setTxSig] = useState<string | null>(null);

//   // step 2 – provisioning values (from box label)
//   const [ssid, setSsid] = useState("");     // e.g. CS-6FE1A9 (this becomes `deviceId`)
//   const [pop, setPop] = useState("");       // e.g. CS-POP-1234
//   const [friendlyName, setFriendlyName] = useState(""); // seller-chosen device name (optional)

//   // step 3 – claim (use Device ID = SSID; claim code = PoP)
//   const [deviceId, setDeviceId] = useState("");
//   const [claimCode, setClaimCode] = useState("");
//   const [claimLoading, setClaimLoading] = useState(false);
//   const [claimError, setClaimError] = useState<string | null>(null);
//   const [claimed, setClaimed] = useState(false);

//   // auto-claim state
//   const triedAuto = useRef(false);
//   const retryTimer = useRef<NodeJS.Timeout | null>(null);
//   const retryCount = useRef(0);

//   // Prefill device+code from URL (?dev=...&code=...) OR from step2 fields
//   useEffect(() => {
//     if (!search) return;
//     const dev = search.get("dev");
//     const code = search.get("code");
//     if (dev) setDeviceId(dev);
//     if (code) setClaimCode(code);
//   }, [search]);

//   useEffect(() => {
//     if (!deviceId && ssid) setDeviceId(ssid);
//     if (!claimCode && pop) setClaimCode(pop);
//   }, [ssid, pop]); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     // Auto-claim if we land on step=3 with everything present
//     if (step !== 3) return;
//     if (triedAuto.current) return;
//     if (!publicKey || !deviceId || !claimCode) return;
//     triedAuto.current = true;
//     void handleClaim(true);
//   }, [step, publicKey, deviceId, claimCode]); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
//   }, []);

//   const handlePay = async () => {
//     setPaying(true);
//     setPayError(null);
//     try {
//       const { txSignature } = await payToStart({ fullName, email, phone, address });
//       setTxSig(txSignature);
//       setStep(2); // show provisioning; user can leave and come back with ?step=2
//     } catch (e: any) {
//       setPayError(e?.message || "Payment failed");
//     } finally {
//       setPaying(false);
//     }
//   };

//   const handleClaim = async (fromAuto = false) => {
//     if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
//     setClaimLoading(true);
//     setClaimError(fromAuto ? "Checking device registration..." : null);

//     try {
//       if (!deviceId || !claimCode) throw new Error("Device ID and PoP are required");
//       await claimDevice(deviceId.trim(), claimCode.trim()); // claimCode = PoP
//       // Save seller-provided name immediately after claim (if provided)
//       if (friendlyName && friendlyName.trim().length > 0) {
//         try {
//           await renameDevice(deviceId.trim(), friendlyName.trim());
//         } catch (e) {
//           // Don't block success if rename fails; show a soft message instead
//           console.warn("rename failed:", (e as any)?.message);
//         }
//       }
//       setClaimed(true);
//       setStep(4);
//       // Show success briefly, then go to dashboard
//       setTimeout(() => router.push(`/seller/dashboard?claimed=1&device=${encodeURIComponent(deviceId)}`), 900);
//     } catch (e: any) {
//       const msg = String(e?.message || "");
//       const isAuth = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
//       if (isAuth) {
//         // Auto-retry ~2 minutes while device finishes DPS bootstrap
//         if (retryCount.current < 24) {
//           retryCount.current += 1;
//           setClaimError("Waiting for device to finish setup… retrying automatically.");
//           retryTimer.current = setTimeout(() => void handleClaim(true), 5000);
//         } else {
//           setClaimError("Still not ready. Ensure the ESP finished provisioning and try again.");
//         }
//       } else {
//         setClaimError(msg || "Claim failed");
//       }
//     } finally {
//       setClaimLoading(false);
//     }
//   };

//   const provisionQR = useMemo(() => {
//     if (!ssid || !pop) return "";
//     return makeEspressifProvisionQR(ssid.trim(), pop.trim());
//   }, [ssid, pop]);

//   const claimPrefillQR = useMemo(() => {
//     if (!deviceId || !claimCode) return "";
//     return `${PUBLIC_BASE}/seller/devices?dev=${encodeURIComponent(deviceId)}&code=${encodeURIComponent(claimCode)}&step=3`;
//   }, [deviceId, claimCode]);

//   const Header = (
//     <div className="flex items-center mb-8">
//       <Button
//         variant="ghost"
//         size="sm"
//         onClick={() => router.push("/seller/dashboard")}
//         className="mr-4"
//       >
//         <ArrowLeft className="h-4 w-4 mr-2" /> Back
//       </Button>
//       <div>
//         <h1 className="text-3xl font-bold">Add a Device</h1>
//         <p className="text-muted-foreground">Step {step} of 4</p>
//       </div>
//     </div>
//   );

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />
//       <div className="container mx-auto px-4 pt-24 pb-16">
//         {Header}

//         <div className="max-w-3xl mx-auto space-y-8">
//           {/* STEP 1: contact + pay */}
//           {step === 1 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <User className="mr-2" /> Contact & Shipping
//                 </CardTitle>
//                 <CardDescription>
//                   We’ll ship your pre-configured ESP to this address. Confirm with a small on-chain payment.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue.
//                   </p>
//                 )}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Full name</Label>
//                     <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
//                   </div>
//                   <div>
//                     <Label>Phone</Label>
//                     <div className="flex items-center gap-2">
//                       <Phone className="h-4 w-4 text-muted-foreground" />
//                       <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
//                     </div>
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Email</Label>
//                   <div className="flex items-center gap-2">
//                     <Mail className="h-4 w-4 text-muted-foreground" />
//                     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Shipping address</Label>
//                   <div className="flex items-center gap-2">
//                     <MapPin className="h-4 w-4 text-muted-foreground" />
//                     <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Market St, City, Country" />
//                   </div>
//                 </div>
//                 {payError && <p className="text-red-600 text-sm">{payError}</p>}
//                 {txSig && (
//                   <p className="text-xs text-muted-foreground">
//                     Payment confirmed: <span className="font-mono">{txSig}</span>
//                   </p>
//                 )}
//               </CardContent>
//               <CardFooter className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2 md:justify-between">
//                 <div className="text-xs text-muted-foreground">
//                   You can come back later using this link:{" "}
//                   <a className="underline" href={`${PUBLIC_BASE}/seller/devices?step=2`}>{`${PUBLIC_BASE}/seller/devices?step=2`}</a>
//                 </div>
//                 <div className="flex gap-2 w-full md:w-auto">
//                   <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
//                     Cancel
//                   </Button>
//                   <Button
//                     onClick={handlePay}
//                     disabled={!publicKey || paying || !fullName || !email || !address}
//                   >
//                     {paying ? (
//                       <>
//                         <RotateCw className="animate-spin mr-2" />
//                         Confirm & Pay
//                       </>
//                     ) : (
//                       <>
//                         Confirm & Pay <CreditCard className="ml-2 h-4 w-4" />
//                       </>
//                     )}
//                   </Button>
//                 </div>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 2: provisioning instructions + real Espressif QR */}
//           {step === 2 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Wifi className="mr-2" /> Connect your device to Wi-Fi
//                 </CardTitle>
//                 <CardDescription>
//                   When your package arrives, power the ESP and use Espressif’s mobile app to provision via SoftAP.
//                 </CardDescription>
//               </CardHeader>

//               <CardContent className="space-y-5 text-sm leading-6">
//                 <div className="rounded-md bg-muted p-3 flex items-start gap-3">
//                   <Download className="h-4 w-4 mt-1 text-muted-foreground" />
//                   <div>
//                     <div className="font-medium">Get the Espressif app</div>
//                     <ul className="list-disc ml-5">
//                       <li>Open the App Store / Google Play and search <b>“ESP SoftAP Provisioning”</b>.</li>
//                       <li>Install the official Espressif app.</li>
//                     </ul>
//                   </div>
//                 </div>

//                 <ol className="list-decimal ml-5 space-y-2">
//                   <li>Plug in the device. A Wi-Fi network like <b>CS-XXXXXX</b> will appear.</li>
//                   <li>Open the app and choose <b>Provision via SoftAP</b>. You can scan the QR below or tap “I don’t have a QR code” and type the values from the label.</li>
//                   <li>Enter your home/office Wi-Fi credentials in the app when prompted.</li>
//                 </ol>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <Label>Device SSID (from label)</Label>
//                     <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="CS-6FE1A9" />
//                   </div>
//                   <div>
//                     <Label>PoP (from label)</Label>
//                     <Input value={pop} onChange={(e) => setPop(e.target.value)} placeholder="CS-POP-1234" />
//                   </div>
//                 </div>

//                 <div>
//                   <Label>Device Name (optional — will be saved after claim)</Label>
//                   <Input
//                     value={friendlyName}
//                     onChange={(e) => setFriendlyName(e.target.value)}
//                     placeholder="e.g. Greenhouse #2"
//                   />
//                 </div>

//                 {ssid && pop && (
//                   <>
//                     <Separator className="my-2" />
//                     <div>
//                       <Label>Provisioning QR (scan with Espressif app)</Label>
//                       <div className="p-3 border rounded inline-block">
//                         <QRimg data={makeEspressifProvisionQR(ssid.trim(), pop.trim())} size={200} />
//                       </div>
//                       <p className="text-xs text-muted-foreground mt-2">
//                         Contains: <code className="font-mono">{"{ver,name,pop,transport:\"softap\"}"}</code>
//                       </p>
//                     </div>
//                   </>
//                 )}

//                 <Separator className="my-4" />
//                 <div className="text-muted-foreground">
//                   After Wi-Fi is set, the device fetches its certificate and “bootstraps” with our backend. Then you can claim it to your wallet.
//                 </div>
//               </CardContent>

//               <CardFooter className="flex flex-wrap gap-2 justify-between">
//                 <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
//                 <div className="flex gap-2">
//                   <Button variant="secondary" onClick={() => router.push("/seller/dashboard")}>
//                     I’ll finish later
//                   </Button>
//                   <Button onClick={() => {
//                     setDeviceId(ssid.trim());
//                     setClaimCode(pop.trim());
//                     setStep(3);
//                   }}>
//                     Continue to Claim <ExternalLink className="ml-2 h-4 w-4" />
//                   </Button>
//                 </div>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 3: claim (code = PoP) */}
//           {step === 3 && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <QrCode className="mr-2" /> Claim your device
//                 </CardTitle>
//                 <CardDescription>
//                   Bind the device to your wallet. Use the same <b>PoP</b> you used in the Espressif app.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {!publicKey && (
//                   <p className="text-amber-600 text-sm">
//                     Connect your wallet to continue. (We need your public key for the claim.)
//                   </p>
//                 )}
//                 <div>
//                   <Label>Device ID</Label>
//                   <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="CS-6FE1A9" />
//                 </div>
//                 <div>
//                   <Label>Claim code (same as PoP)</Label>
//                   <Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="CS-POP-1234" />
//                   <p className="text-xs text-muted-foreground mt-1">
//                     Tip: Must match the PoP you entered during provisioning.
//                   </p>
//                 </div>

//                 {deviceId && claimCode && (
//                   <div className="mt-2">
//                     <Label>Optional: resume link (QR)</Label>
//                     <div className="p-3 border rounded inline-block">
//                       <QRimg data={claimPrefillQR} size={176} />
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Scan on another device to open this page prefilled.
//                     </p>
//                   </div>
//                 )}

//                 {claimError && <p className="text-red-600 text-sm">{claimError}</p>}
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={back}>Back</Button>
//                 <Button onClick={() => void handleClaim()} disabled={!publicKey || claimLoading || !deviceId || !claimCode}>
//                   {claimLoading ? (<><RotateCw className="animate-spin mr-2" /> Checking…</>) : (<>Claim <ShieldCheck className="ml-2 h-4 w-4" /></>)}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* STEP 4: success */}
//           {step === 4 && claimed && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center text-green-600">
//                   <Check className="mr-2" /> Device claimed
//                 </CardTitle>
//                 <CardDescription>
//                   <span className="font-mono">{deviceId}</span> is now linked to your account{friendlyName ? <> as “<b>{friendlyName}</b>”</> : null}.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <p>You’ll start seeing live readings in your dashboard within a minute.</p>
//               </CardContent>
//               <CardFooter>
//                 <Button onClick={() => router.push("/seller/dashboard")}>Go to Dashboard</Button>
//               </CardFooter>
//             </Card>
//           )}
//         </div>
//       </div>
//     </main>
//   );
// }


"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePayToStart } from "@/hooks/usePayToStart";
import { useClaimDevice } from "@/hooks/useClaimDevice";
import { useRenameDevice } from "@/hooks/useRenameDevice";
import { emitReward } from "@/components/sensor";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Check, MapPin, Phone, Mail, User, Wifi, QrCode, ShieldCheck, RotateCw, CreditCard, ExternalLink, Download,
} from "lucide-react";

const PUBLIC_BASE =
  process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

function QRimg({ data, size = 180 }: { data: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
  return <img src={src} width={size} height={size} alt="QR Code" className="rounded" />;
}

// Espressif SoftAP provisioning QR payload
function makeEspressifProvisionQR(name: string, pop: string) {
  return JSON.stringify({ ver: "v1", name, pop, transport: "softap" });
}

export default function RegisterDeviceClient() {
  const router = useRouter();
  const search = useSearchParams();
  const { publicKey } = useWallet();
  const payToStart = usePayToStart();
  const claimDevice = useClaimDevice();
  const renameDevice = useRenameDevice();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Allow resuming via ?step=2 or ?step=3
  useEffect(() => {
    if (!search) return;
    const s = Number(search.get("step") || "0");
    if (s >= 1 && s <= 4) setStep(s as 1 | 2 | 3 | 4);
  }, [search]);

  // step 1 – contact + pay
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // step 2 – provisioning values (from box label)
  const [ssid, setSsid] = useState("");     // e.g. CS-6FE1A9 (this becomes `deviceId`)
  const [pop, setPop] = useState("");       // e.g. CS-POP-1234
  const [friendlyName, setFriendlyName] = useState(""); // optional seller name

  // step 3 – claim (use Device ID = SSID; claim code = PoP)
  const [deviceId, setDeviceId] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // auto-claim state
  const triedAuto = useRef(false);
  const retryTimer = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);

  // Prefill device+code from URL (?dev=...&code=...) OR from step2 fields
  useEffect(() => {
    if (!search) return;
    const dev = search.get("dev");
    const code = search.get("code");
    if (dev) setDeviceId(dev);
    if (code) setClaimCode(code);
  }, [search]);

  useEffect(() => {
    if (!deviceId && ssid) setDeviceId(ssid);
    if (!claimCode && pop) setClaimCode(pop);
  }, [ssid, pop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Auto-claim if we land on step=3 with everything present
    if (step !== 3) return;
    if (triedAuto.current) return;
    if (!publicKey || !deviceId || !claimCode) return;
    triedAuto.current = true;
    void handleClaim(true);
  }, [step, publicKey, deviceId, claimCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  const handlePay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      // returns { orderId, txSignature }
      const { orderId } = await payToStart({ fullName, email, phone, address });

      // ✅ Redirect to a dedicated “next steps” page the user can bookmark/share
      const url = `/seller/devices/next?order=${encodeURIComponent(orderId)}${
        email ? `&email=${encodeURIComponent(email)}` : ""
      }`;
      router.replace(url);
    } catch (e: any) {
      setPayError(e?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleClaim = async (fromAuto = false) => {
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    setClaimLoading(true);
    setClaimError(fromAuto ? "Checking device registration..." : null);

    try {
      if (!deviceId || !claimCode) throw new Error("Device ID and PoP are required");
      await claimDevice(deviceId.trim(), claimCode.trim()); // claimCode = PoP
      
      // 🎉 Emit reward animation for successful device claim
      emitReward(50); // 50 SENSOR tokens as per REWARD_RULES.deviceRegistration
      
      // Save seller-provided name immediately after claim (if provided)
      if (friendlyName && friendlyName.trim().length > 0) {
        try {
          await renameDevice(deviceId.trim(), friendlyName.trim());
        } catch (e) {
          console.warn("rename failed:", (e as any)?.message);
        }
      }
      setClaimed(true);
      setStep(4);
      setTimeout(() => router.push(`/seller/dashboard?claimed=1&device=${encodeURIComponent(deviceId)}`), 900);
    } catch (e: any) {
      const msg = String(e?.message || "");
      const isAuth = msg.includes("401") || msg.toLowerCase().includes("unauthorized");
      if (isAuth) {
        if (retryCount.current < 24) {
          retryCount.current += 1;
          setClaimError("Waiting for device to finish setup… retrying automatically.");
          retryTimer.current = setTimeout(() => void handleClaim(true), 5000);
        } else {
          setClaimError("Still not ready. Ensure the ESP finished provisioning and try again.");
        }
      } else {
        setClaimError(msg || "Claim failed");
      }
    } finally {
      setClaimLoading(false);
    }
  };

  const provisionQR = useMemo(() => {
    if (!ssid || !pop) return "";
    return makeEspressifProvisionQR(ssid.trim(), pop.trim());
  }, [ssid, pop]);

  const claimPrefillQR = useMemo(() => {
    if (!deviceId || !claimCode) return "";
    return `${PUBLIC_BASE}/seller/devices?dev=${encodeURIComponent(deviceId)}&code=${encodeURIComponent(claimCode)}&step=3`;
  }, [deviceId, claimCode]);

  const Header = (
    <div className="flex items-center mb-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/seller/dashboard")}
        className="mr-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      <div>
        <h1 className="text-3xl font-bold">Add a Device</h1>
        <p className="text-muted-foreground">Step {step} of 4</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        {Header}

        <div className="max-w-3xl mx-auto space-y-8">
          {/* STEP 1: contact + pay */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2" /> Contact & Shipping
                </CardTitle>
                <CardDescription>
                  We’ll ship your pre-configured ESP to this address. Confirm with a small on-chain payment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!publicKey && (
                  <p className="text-amber-600 text-sm">
                    Connect your wallet to continue.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Full name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </div>
                <div>
                  <Label>Shipping address</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Market St, City, Country" />
                  </div>
                </div>
                {payError && <p className="text-red-600 text-sm">{payError}</p>}
              </CardContent>
              <CardFooter className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePay}
                  disabled={!publicKey || paying || !fullName || !email || !address}
                >
                  {paying ? (
                    <>
                      <RotateCw className="animate-spin mr-2" />
                      Confirm & Pay
                    </>
                  ) : (
                    <>
                      Confirm & Pay <CreditCard className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* STEP 2: provisioning instructions + real Espressif QR */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wifi className="mr-2" /> Connect your device to Wi-Fi
                </CardTitle>
                <CardDescription>
                  When your package arrives, power the ESP and use Espressif’s mobile app to provision via SoftAP.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-sm leading-6">
                <div className="rounded-md bg-muted p-3 flex items-start gap-3">
                  <Download className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Get the Espressif app</div>
                    <ul className="list-disc ml-5">
                      <li>Open the App Store / Google Play and search <b>“ESP SoftAP Provisioning”</b>.</li>
                      <li>Install the official Espressif app.</li>
                    </ul>
                  </div>
                </div>

                <ol className="list-decimal ml-5 space-y-2">
                  <li>Plug in the device. A Wi-Fi network like <b>CS-XXXXXX</b> will appear.</li>
                  <li>Open the app and choose <b>Provision via SoftAP</b>. You can scan the QR below or tap “I don’t have a QR code” and type the values from the label.</li>
                  <li>Enter your Wi-Fi credentials in the app when prompted.</li>
                </ol>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Device SSID (from label)</Label>
                    <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="CS-6FE1A9" />
                  </div>
                  <div>
                    <Label>PoP (from label)</Label>
                    <Input value={pop} onChange={(e) => setPop(e.target.value)} placeholder="CS-POP-1234" />
                  </div>
                </div>

                <div>
                  <Label>Device Name (optional — will be saved after claim)</Label>
                  <Input
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    placeholder="e.g. Greenhouse #2"
                  />
                </div>

                {ssid && pop && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <Label>Provisioning QR (scan with Espressif app)</Label>
                      <div className="p-3 border rounded inline-block">
                        <QRimg data={makeEspressifProvisionQR(ssid.trim(), pop.trim())} size={200} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Contains: <code className="font-mono">{"{ver,name,pop,transport:\"softap\"}"}</code>
                      </p>
                    </div>
                  </>
                )}

                <Separator className="my-4" />
                <div className="text-muted-foreground">
                  After Wi-Fi is set, the device fetches its certificate and “bootstraps” with our backend. Then you can claim it to your wallet.
                </div>
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2 justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => router.push("/seller/dashboard")}>
                    I’ll finish later
                  </Button>
                  <Button onClick={() => {
                    setDeviceId(ssid.trim());
                    setClaimCode(pop.trim());
                    setStep(3);
                  }}>
                    Continue to Claim <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}

          {/* STEP 3: claim (code = PoP) */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="mr-2" /> Claim your device
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!publicKey && (
                  <p className="text-amber-600 text-sm">
                    Connect your wallet to continue. (We need your public key for the claim.)
                  </p>
                )}
                <div>
                  <Label>Device ID</Label>
                  <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="CS-6FE1A9" />
                </div>
                <div>
                  <Label>Claim code (same as PoP)</Label>
                  <Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="CS-POP-1234" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Must match the PoP you entered during provisioning.
                  </p>
                </div>

                {deviceId && claimCode && (
                  <div className="mt-2">
                    <Label>Optional: resume link (QR)</Label>
                    <div className="p-3 border rounded inline-block">
                      <QRimg data={`${PUBLIC_BASE}/seller/devices?dev=${encodeURIComponent(deviceId)}&code=${encodeURIComponent(claimCode)}&step=3`} size={176} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Scan on another device to open this page prefilled.
                    </p>
                  </div>
                )}

                {claimError && <p className="text-red-600 text-sm">{claimError}</p>}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={() => void handleClaim()} disabled={!publicKey || claimLoading || !deviceId || !claimCode}>
                  {claimLoading ? (<><RotateCw className="animate-spin mr-2" /> Checking…</>) : (<>Claim <ShieldCheck className="ml-2 h-4 w-4" /></>)}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* STEP 4: success */}
          {step === 4 && claimed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-600">
                  <Check className="mr-2" /> Device claimed
                </CardTitle>
                <CardDescription>
                  <span className="font-mono">{deviceId}</span> is now linked to your account{friendlyName ? <> as “<b>{friendlyName}</b>”</> : null}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>You’ll start seeing live readings in your dashboard within a minute.</p>
              </CardContent>
              <CardFooter>
                <Button onClick={() => router.push("/seller/dashboard")}>Go to Dashboard</Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
