
// // "use client";

// // import { useState } from "react";
// // import { useRouter } from "next/navigation";
// // import { useWalletContext } from "@/components/wallet-context-provider";
// // import { Navbar } from "@/components/navbar";
// // import {
// //   Card,
// //   CardContent,
// //   CardDescription,
// //   CardFooter,
// //   CardHeader,
// //   CardTitle,
// // } from "@/components/ui/card";
// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Label } from "@/components/ui/label";
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select";
// // import { ArrowLeft, RotateCw, Check } from "lucide-react";
// // import { useMyDevices } from "@/hooks/useMyDevices";
// // import { useCreateListing, CreateListingParams } from "@/hooks/useCreateListing";

// // export default function CreateListingClient() {
// //   const router = useRouter();
// //   const { connected, publicKey } = useWalletContext();
// //   const sellerPubkey = publicKey || null;
// //   const { devices, isLoading, isError, refetch } = useMyDevices(sellerPubkey);
// //   const createListing = useCreateListing();

// //   // Form state
// //   const [selectedDevice, setSelectedDevice] = useState<string>("");
// //   const [pricePerUnit, setPricePerUnit] = useState<string>("");
// //   const [totalDataUnits, setTotalDataUnits] = useState<string>("");
// //   const [expiresAt, setExpiresAt] = useState<string>("");
// //   const [dataCid, setDataCid] = useState<string>("");
// //   const [isCreating, setIsCreating] = useState<boolean>(false);
// //   const [isSuccess, setIsSuccess] = useState<boolean>(false);
// //   const [errorMessage, setErrorMessage] = useState<string | null>(null);

// //   // Handle device selection and prefill dataCid
// //   const handleDeviceSelect = (deviceId: string) => {
// //     setSelectedDevice(deviceId);
// //     const device = devices?.find((d) => d.deviceId === deviceId);
// //     if (device?.latestDataCid) {
// //       setDataCid(device.latestDataCid);
// //     } else {
// //       setDataCid("");
// //     }
// //   };

// //   // Validate and submit listing
// //   const handleCreateListing = async () => {
// //     if (!selectedDevice || !pricePerUnit || !totalDataUnits) {
// //       setErrorMessage("Please fill out all required fields.");
// //       return;
// //     }

// //     const price = parseFloat(pricePerUnit);
// //     const units = parseInt(totalDataUnits, 10);
// //     if (isNaN(price) || price <= 0) {
// //       setErrorMessage("Price per unit must be a positive number.");
// //       return;
// //     }
// //     if (isNaN(units) || units <= 0) {
// //       setErrorMessage("Total data units must be a positive integer.");
// //       return;
// //     }

// //     const params: CreateListingParams = {
// //       deviceId: selectedDevice,
// //       dataCid: dataCid || "default-cid-from-backend", // Fallback if empty
// //       pricePerUnit: price,
// //       totalDataUnits: units,
// //       expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
// //     };

// //     setIsCreating(true);
// //     setErrorMessage(null);

// //     try {
// //       const txSignature = await createListing(params);
// //       console.log(`Listing created successfully with txSignature: ${txSignature}`);
// //       setIsSuccess(true);
// //       setTimeout(() => router.push("/seller/dashboard"), 2000); // Redirect after success
// //     } catch (error: any) {
// //       console.error("Error creating listing:", error);
// //       setErrorMessage(error.message || "Failed to create listing. Please try again.");
// //     } finally {
// //       setIsCreating(false);
// //     }
// //   };

// //   if (!sellerPubkey || !connected) {
// //     return (
// //       <main className="min-h-screen bg-background">
// //         <Navbar />
// //         <div className="container mx-auto px-4 pt-24 pb-16">
// //           <p className="text-muted-foreground">Please connect your wallet to create a listing.</p>
// //         </div>
// //       </main>
// //     );
// //   }

// //   if (isLoading) {
// //     return (
// //       <main className="min-h-screen bg-background">
// //         <Navbar />
// //         <div className="container mx-auto px-4 pt-24 pb-16">
// //           <p className="text-muted-foreground">Loading devices...</p>
// //         </div>
// //       </main>
// //     );
// //   }

// //   if (isError) {
// //     return (
// //       <main className="min-h-screen bg-background">
// //         <Navbar />
// //         <div className="container mx-auto px-4 pt-24 pb-16">
// //           <p className="text-red-500">Error fetching devices. Please try again.</p>
// //           <Button variant="outline" onClick={refetch} className="mt-4">
// //             Retry
// //           </Button>
// //         </div>
// //       </main>
// //     );
// //   }

// //   if (!devices || devices.length === 0) {
// //     return (
// //       <main className="min-h-screen bg-background">
// //         <Navbar />
// //         <div className="container mx-auto px-4 pt-24 pb-16">
// //           <p className="text-muted-foreground">
// //             No devices found. Register a device to create a listing.
// //           </p>
// //         </div>
// //       </main>
// //     );
// //   }

// //   return (
// //     <main className="min-h-screen bg-background">
// //       <Navbar />
// //       <div className="container mx-auto px-4 pt-24 pb-16">
// //         <div className="flex items-center mb-8">
// //           <Button
// //             variant="ghost"
// //             size="sm"
// //             onClick={() => router.push("/seller/dashboard")}
// //             className="mr-4"
// //           >
// //             <ArrowLeft className="h-4 w-4 mr-2" />
// //             Back to Dashboard
// //           </Button>
// //           <div>
// //             <h1 className="text-3xl font-bold">Create Data Listing</h1>
// //             <p className="text-muted-foreground">
// //               List your IoT data for sale on the marketplace
// //             </p>
// //           </div>
// //         </div>

// //         <div className="max-w-3xl mx-auto">
// //           <Card className="border-primary/20 shadow-lg shadow-primary/5">
// //             <CardHeader>
// //               <CardTitle>Select a Device</CardTitle>
// //               <CardDescription>Choose a registered device to create a listing for</CardDescription>
// //             </CardHeader>
// //             <CardContent className="space-y-6">
// //               <div className="space-y-2">
// //                 <Label htmlFor="device-select">Your Devices</Label>
// //                 <Select value={selectedDevice} onValueChange={handleDeviceSelect}>
// //                   <SelectTrigger id="device-select">
// //                     <SelectValue placeholder="Choose a registered device" />
// //                   </SelectTrigger>
// //                   <SelectContent>
// //                                       {devices.map((device, i) => (
// //                     <SelectItem
// //                       key={`${device.deviceId}-${i}`}
// //                       value={device.deviceId}
// //                     >
// //                       {device.metadata?.deviceName || "Unnamed Device"} (
// //                       {device.deviceId})
// //                     </SelectItem>
// //                   ))}
// //                   </SelectContent>
// //                 </Select>
// //               </div>

// //               {selectedDevice && (
// //                 <div className="space-y-4">
// //                   <h3 className="text-lg font-medium">Listing Details</h3>
// //                   <div className="grid grid-cols-2 gap-4">
// //                     <div className="space-y-2">
// //                       <Label htmlFor="price-per-unit">Price per Unit (usdc)</Label>
// //                       <Input
// //                         id="price-per-unit"
// //                         type="number"
// //                         step="0.01"
// //                         min="0"
// //                         placeholder="0.00"
// //                         value={pricePerUnit}
// //                         onChange={(e) => setPricePerUnit(e.target.value)}
// //                       />
// //                     </div>
// //                     <div className="space-y-2">
// //                       <Label htmlFor="total-data-units">Total Data Units</Label>
// //                       <Input
// //                         id="total-data-units"
// //                         type="number"
// //                         min="1"
// //                         placeholder="1000"
// //                         value={totalDataUnits}
// //                         onChange={(e) => setTotalDataUnits(e.target.value)}
// //                       />
// //                     </div>
// //                   </div>
// //                   <div className="space-y-2">
// //                     <Label htmlFor="expires-at">Expires At (optional)</Label>
// //                     <Input
// //                       id="expires-at"
// //                       type="datetime-local"
// //                       value={expiresAt}
// //                       onChange={(e) => setExpiresAt(e.target.value)}
// //                     />
// //                   </div>
// //                   {dataCid && (
// //                     <div className="space-y-2">
// //                       <Label htmlFor="data-cid">Data CID (prefilled)</Label>
// //                       <Input id="data-cid" value={dataCid} disabled />
// //                     </div>
// //                   )}
// //                 </div>
// //               )}

// //               {errorMessage && (
// //                 <p className="text-red-500 text-sm">{errorMessage}</p>
// //               )}
// //             </CardContent>
// //             <CardFooter className="flex justify-between">
// //               <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
// //                 Cancel
// //               </Button>
// //               {selectedDevice && (
// //                 <Button
// //                   onClick={handleCreateListing}
// //                   disabled={isCreating || isSuccess}
// //                   className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${
// //                     isSuccess ? "bg-green-500" : ""
// //                   }`}
// //                 >
// //                   {isCreating ? (
// //                     <>
// //                       <RotateCw className="mr-2 h-4 w-4 animate-spin" />
// //                       Creating...
// //                     </>
// //                   ) : isSuccess ? (
// //                     <>
// //                       <Check className="mr-2 h-4 w-4" />
// //                       Created Successfully
// //                     </>
// //                   ) : (
// //                     "Create Listing"
// //                   )}
// //                 </Button>
// //               )}
// //             </CardFooter>
// //           </Card>
// //         </div>
// //       </div>
// //     </main>
// //   );
// // }

// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { useWalletContext } from "@/components/wallet-context-provider";
// import { Navbar } from "@/components/navbar";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { ArrowLeft, RotateCw, Check } from "lucide-react";
// import { useMyDevices } from "@/hooks/useMyDevices";
// import { useCreateListing, CreateListingParams } from "@/hooks/useCreateListing";

// const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";

// export default function CreateListingClient() {
//   const router = useRouter();
//   const { connected, publicKey } = useWalletContext();
//   const sellerPubkey = publicKey || null;
//   const { devices, isLoading, isError, refetch } = useMyDevices(sellerPubkey);
//   const createListing = useCreateListing();

//   // Form state
//   const [selectedDevice, setSelectedDevice] = useState<string>("");
//   const [pricePerUnit, setPricePerUnit] = useState<string>("");
//   const [totalDataUnits, setTotalDataUnits] = useState<string>("");
//   const [expiresAt, setExpiresAt] = useState<string>("");
//   const [dataCid, setDataCid] = useState<string>("");
//   const [dekCapsuleForMxeCid, setDekCapsuleForMxeCid] = useState<string>("");
//   const [isCreating, setIsCreating] = useState<boolean>(false);
//   const [isSuccess, setIsSuccess] = useState<boolean>(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [isUploadingCapsule, setIsUploadingCapsule] = useState<boolean>(false);

//   // Handle device selection and prefill dataCid
//   const handleDeviceSelect = (deviceId: string) => {
//     setSelectedDevice(deviceId);
//     const device = devices?.find((d) => d.deviceId === deviceId);
//     if (device?.latestDataCid) setDataCid(device.latestDataCid);
//     else setDataCid("");
//   };

//   // Seal DEK to MXE & upload to Walrus → autofill blobId
//   const handleUploadCapsule = async () => {
//     try {
//       setErrorMessage(null);
//       const dekBase64 = window.prompt(
//         "Paste the 32-byte DEK (base64) that was used to encrypt this dataset:"
//       );
//       if (!dekBase64) return;

//       setIsUploadingCapsule(true);
//       const res = await fetch(`${API}/capsules/upload`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ dekBase64 }),
//       });
//       if (!res.ok) {
//         const text = await res.text();
//         throw new Error(text || "Capsule upload failed");
//       }
//       const { blobId } = (await res.json()) as { blobId: string };
//       setDekCapsuleForMxeCid(blobId);
//     } catch (e: any) {
//       setErrorMessage(e?.message || "Capsule upload failed");
//     } finally {
//       setIsUploadingCapsule(false);
//     }
//   };

//   // Validate and submit listing
//   const handleCreateListing = async () => {
//     if (!selectedDevice || !pricePerUnit || !totalDataUnits) {
//       setErrorMessage("Please fill out all required fields.");
//       return;
//     }

//     const price = parseFloat(pricePerUnit);
//     const units = parseInt(totalDataUnits, 10);
//     if (isNaN(price) || price <= 0) {
//       setErrorMessage("Price per unit must be a positive number.");
//       return;
//     }
//     if (isNaN(units) || units <= 0) {
//       setErrorMessage("Total data units must be a positive integer.");
//       return;
//     }

//     const capsule = dekCapsuleForMxeCid.trim();
//     if (!capsule || capsule.length > 128) {
//       setErrorMessage("DEK Capsule blobId is required and must be ≤ 128 chars.");
//       return;
//     }

//     const expiresAtSeconds =
//       expiresAt && expiresAt.length > 0
//         ? Math.floor(new Date(expiresAt).getTime() / 1000)
//         : null;

//     const params: CreateListingParams = {
//       deviceId: selectedDevice,
//       dataCid: dataCid || "default-cid-from-backend",
//       dekCapsuleForMxeCid: capsule,
//       pricePerUnit: price,
//       totalDataUnits: units,
//       expiresAt: expiresAtSeconds,
//     };

//     setIsCreating(true);
//     setErrorMessage(null);

//     try {
//       const txSignature = await createListing(params);
//       console.log(`Listing created successfully with txSignature: ${txSignature}`);
//       setIsSuccess(true);
//       setTimeout(() => router.push("/seller/dashboard"), 2000);
//     } catch (error: any) {
//       console.error("Error creating listing:", error);
//       setErrorMessage(error.message || "Failed to create listing. Please try again.");
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   if (!sellerPubkey || !connected) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16">
//           <p className="text-muted-foreground">Please connect your wallet to create a listing.</p>
//         </div>
//       </main>
//     );
//   }

//   if (isLoading) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16">
//           <p className="text-muted-foreground">Loading devices...</p>
//         </div>
//       </main>
//     );
//   }

//   if (isError) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16">
//           <p className="text-red-500">Error fetching devices. Please try again.</p>
//           <Button variant="outline" onClick={refetch} className="mt-4">
//             Retry
//           </Button>
//         </div>
//       </main>
//     );
//   }

//   if (!devices || devices.length === 0) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16">
//           <p className="text-muted-foreground">
//             No devices found. Register a device to create a listing.
//           </p>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />
//       <div className="container mx-auto px-4 pt-24 pb-16">
//         <div className="flex items-center mb-8">
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={() => router.push("/seller/dashboard")}
//             className="mr-4"
//           >
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back to Dashboard
//           </Button>
//           <div>
//             <h1 className="text-3xl font-bold">Create Data Listing</h1>
//             <p className="text-muted-foreground">List your IoT data for sale on the marketplace</p>
//           </div>
//         </div>

//         <div className="max-w-3xl mx-auto">
//           <Card className="border-primary/20 shadow-lg shadow-primary/5">
//             <CardHeader>
//               <CardTitle>Select a Device</CardTitle>
//               <CardDescription>Choose a registered device to create a listing for</CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               <div className="space-y-2">
//                 <Label htmlFor="device-select">Your Devices</Label>
//                 <Select value={selectedDevice} onValueChange={handleDeviceSelect}>
//                   <SelectTrigger id="device-select">
//                     <SelectValue placeholder="Choose a registered device" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {devices.map((device, i) => (
//                       <SelectItem key={`${device.deviceId}-${i}`} value={device.deviceId}>
//                         {device.metadata?.deviceName || "Unnamed Device"} ({device.deviceId})
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               {selectedDevice && (
//                 <div className="space-y-4">
//                   <h3 className="text-lg font-medium">Listing Details</h3>
//                   <div className="grid grid-cols-2 gap-4">
//                     <div className="space-y-2">
//                       <Label htmlFor="price-per-unit">Price per Unit (usdc)</Label>
//                       <Input
//                         id="price-per-unit"
//                         type="number"
//                         step="0.01"
//                         min="0"
//                         placeholder="0.00"
//                         value={pricePerUnit}
//                         onChange={(e) => setPricePerUnit(e.target.value)}
//                       />
//                     </div>
//                     <div className="space-y-2">
//                       <Label htmlFor="total-data-units">Total Data Units</Label>
//                       <Input
//                         id="total-data-units"
//                         type="number"
//                         min="1"
//                         placeholder="1000"
//                         value={totalDataUnits}
//                         onChange={(e) => setTotalDataUnits(e.target.value)}
//                       />
//                     </div>
//                   </div>

//                   {/* DEK capsule blobId (Walrus) */}
//                   <div className="space-y-2">
//                     <Label htmlFor="dek-capsule-cid">DEK Capsule blobId (Walrus)</Label>
//                     <Input
//                       id="dek-capsule-cid"
//                       placeholder="e.g. walrus_blob_id (≤128 chars)"
//                       value={dekCapsuleForMxeCid}
//                       onChange={(e) => setDekCapsuleForMxeCid(e.target.value.trim())}
//                       maxLength={128}
//                     />

//                     <div className="flex items-center gap-3 text-xs">
//                       <button
//                         type="button"
//                         className="underline text-muted-foreground hover:text-foreground"
//                         onClick={() =>
//                           setDekCapsuleForMxeCid(`demo_capsule_${Date.now().toString(36)}`)
//                         }
//                       >
//                         Use demo value
//                       </button>
//                       <button
//                         type="button"
//                         className="underline text-muted-foreground hover:text-foreground disabled:opacity-60"
//                         onClick={handleUploadCapsule}
//                         disabled={isUploadingCapsule}
//                       >
//                         {isUploadingCapsule ? "Uploading capsule…" : "Seal DEK to MXE & upload"}
//                       </button>
//                     </div>
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="expires-at">Expires At (optional)</Label>
//                     <Input
//                       id="expires-at"
//                       type="datetime-local"
//                       value={expiresAt}
//                       onChange={(e) => setExpiresAt(e.target.value)}
//                     />
//                   </div>

//                   {dataCid && (
//                     <div className="space-y-2">
//                       <Label htmlFor="data-cid">Data CID (prefilled)</Label>
//                       <Input id="data-cid" value={dataCid} disabled />
//                     </div>
//                   )}
//                 </div>
//               )}

//               {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
//             </CardContent>
//             <CardFooter className="flex justify-between">
//               <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
//                 Cancel
//               </Button>
//               {selectedDevice && (
//                 <Button
//                   onClick={handleCreateListing}
//                   disabled={isCreating || isSuccess}
//                   className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${
//                     isSuccess ? "bg-green-500" : ""
//                   }`}
//                 >
//                   {isCreating ? (
//                     <>
//                       <RotateCw className="mr-2 h-4 w-4 animate-spin" />
//                       Creating...
//                     </>
//                   ) : isSuccess ? (
//                     <>
//                       <Check className="mr-2 h-4 w-4" />
//                       Created Successfully
//                     </>
//                   ) : (
//                     "Create Listing"
//                   )}
//                 </Button>
//               )}
//             </CardFooter>
//           </Card>
//         </div>
//       </div>
//     </main>
//   );
// }

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { Navbar } from "@/components/navbar";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RotateCw, Check } from "lucide-react";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useCreateListing, CreateListingParams } from "@/hooks/useCreateListing";
import { useRenameDevice } from "@/hooks/useRenameDeviceListing";

export default function CreateListingClient() {
  const router = useRouter();
  const { connected, publicKey } = useWalletContext();
  const sellerPubkey = publicKey || null;

  const { devices, isLoading, isError, refetch } = useMyDevices(sellerPubkey);
  const createListing = useCreateListing();
  const renameDevice = useRenameDevice();

  // Form state
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>("");
  const [pricePerUnit, setPricePerUnit] = useState<string>("");
  const [totalDataUnits, setTotalDataUnits] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [dataCid, setDataCid] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
    const dev = devices?.find(d => d.deviceId === deviceId);
    setDeviceName(dev?.metadata?.deviceName || "");
    setDataCid(dev?.latestDataCid || "");
  };

  const handleRename = async () => {
    if (!selectedDevice) return;
    try {
      setIsRenaming(true);
      await renameDevice(selectedDevice, deviceName.trim());
      await refetch();
    } catch (e: any) {
      setErrorMessage(e?.message || "Rename failed");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCreateListing = async () => {
    if (!selectedDevice || !pricePerUnit || !totalDataUnits) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }
    const price = parseFloat(pricePerUnit);
    const units = parseInt(totalDataUnits, 10);
    if (isNaN(price) || price <= 0) {
      setErrorMessage("Price per unit must be a positive number.");
      return;
    }
    if (isNaN(units) || units <= 0) {
      setErrorMessage("Total data units must be a positive integer.");
      return;
    }

    const expiresAtSeconds =
      expiresAt && expiresAt.length > 0
        ? Math.floor(new Date(expiresAt).getTime() / 1000)
        : null;

    const params: CreateListingParams = {
      deviceId: selectedDevice,
      dataCid: dataCid || "default-cid-from-backend",
      pricePerUnit: price,
      totalDataUnits: units,
      expiresAt: expiresAtSeconds,
    };

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const sig = await createListing(params);
      console.log("listing tx", sig);
      setIsSuccess(true);
      setTimeout(() => router.push("/seller/dashboard"), 1200);
    } catch (e: any) {
      setErrorMessage(e?.message || "Failed to create listing.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!sellerPubkey || !connected) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">Please connect your wallet to create a listing.</p>
        </div>
      </main>
    );
  }
  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">Loading devices…</div>
      </main>
    );
  }
  if (isError) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-red-500">Error fetching devices.</p>
          <Button variant="outline" onClick={refetch} className="mt-4">Retry</Button>
        </div>
      </main>
    );
  }
  if (!devices || devices.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">No devices found. Register a device first.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/seller/dashboard")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Data Listing</h1>
            <p className="text-muted-foreground">List your IoT data for sale on the marketplace</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card className="border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle>Select a Device</CardTitle>
              <CardDescription>Choose a registered device to create a listing for</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="device-select">Your Devices</Label>
                <Select value={selectedDevice} onValueChange={handleDeviceSelect}>
                  <SelectTrigger id="device-select">
                    <SelectValue placeholder="Choose a registered device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d, i) => (
                      <SelectItem key={`${d.deviceId}-${i}`} value={d.deviceId}>
                        {(d.metadata?.deviceName || "Unnamed Device")} ({d.deviceId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDevice && (
                <div className="space-y-4">
                  {/* quick rename */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                      <Label htmlFor="dev-name">Device Name (optional)</Label>
                      <Input id="dev-name" value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Greenhouse #2" />
                    </div>
                    <Button variant="outline" onClick={handleRename} disabled={isRenaming}>
                      {isRenaming ? "Saving…" : "Save Name"}
                    </Button>
                  </div>

                  <h3 className="text-lg font-medium">Listing Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price-per-unit">Price per Unit (usdc)</Label>
                      <Input id="price-per-unit" type="number" step="0.01" min="0"
                        placeholder="0.00" value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total-data-units">Total Data Units</Label>
                      <Input id="total-data-units" type="number" min="1" placeholder="1000"
                        value={totalDataUnits} onChange={(e) => setTotalDataUnits(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires-at">Expires At (optional)</Label>
                    <Input id="expires-at" type="datetime-local" value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>

                  {dataCid && (
                    <div className="space-y-2">
                      <Label htmlFor="data-cid">Data CID (prefilled)</Label>
                      <Input id="data-cid" value={dataCid} disabled />
                    </div>
                  )}
                </div>
              )}

              {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
                Cancel
              </Button>
              {selectedDevice && (
                <Button
                  onClick={handleCreateListing}
                  disabled={isCreating || isSuccess}
                  className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${isSuccess ? "bg-green-500" : ""}`}
                >
                  {isCreating ? (<><RotateCw className="mr-2 h-4 w-4 animate-spin" /> Creating…</>)
                    : isSuccess ? (<><Check className="mr-2 h-4 w-4" /> Created</>)
                    : "Create Listing"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
