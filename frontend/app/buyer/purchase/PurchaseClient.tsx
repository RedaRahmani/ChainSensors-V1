
// // app/buyer/purchase/PurchaseClient.tsx
// "use client";

// import { useState, useEffect } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { useWalletContext } from "@/components/wallet-context-provider";
// import { useActiveListings } from "@/hooks/useActiveListings";
// import { useLatestReading } from "@/hooks/useLatestReading";
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
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Badge } from "@/components/ui/badge";
// import {
//   ArrowLeft,
//   CheckCircle,
//   MapPin,
//   Clock,
//   Star,
//   RotateCw,
//   ThermometerSun,
//   Droplets,
//   Wind,
//   BarChart3,
// } from "lucide-react";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Listing } from "@/hooks/types/listing";

// export default function PurchaseClient() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const { connected, userType } = useWalletContext();
//   const { listings, isLoading: listingsLoading, isError: listingsError } = useActiveListings();
//   const [listing, setListing] = useState<Listing | null>(null);
//   const [isPurchasing, setIsPurchasing] = useState(false);
//   const [isSuccess, setIsSuccess] = useState(false);
//   const [showConfirmDialog, setShowConfirmDialog] = useState(false);
//   const [purchaseError, setPurchaseError] = useState<string | null>(null);

//   // Fetch preview data for the specific listing
//   const deviceId = listing?.deviceId || "";
//   const { reading, isLoading: previewLoading, isError: previewError } = useLatestReading(deviceId);

//   useEffect(() => {
//     if (!connected) {
//       router.push("/");
//       return;
//     }

//     if (userType !== "buyer") {
//       router.push("/");
//       return;
//     }

//     const listingId = searchParams.get("id");
//     if (!listingId) {
//       router.push("/buyer/marketplace");
//       return;
//     }

//     if (!listingsLoading && !listingsError && listings) {
//       const foundListing = listings.find((item) => item._id === listingId);
//       if (!foundListing) {
//         router.push("/buyer/marketplace");
//         return;
//       }
//       setListing(foundListing);
//     }
//   }, [connected, userType, router, searchParams, listings, listingsLoading, listingsError]);

//   const handlePurchase = () => {
//     setShowConfirmDialog(true);
//   };

//   const confirmPurchase = async () => {
//     setShowConfirmDialog(false);
//     setIsPurchasing(true);
//     setPurchaseError(null);

//     try {
//       // Simulate a purchase API call to the backend (replace with actual endpoint)
//       const response = await fetch("http://localhost:3003/listings/purchase", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           listingId: listing?._id,
//           buyerPubkey: "mock-buyer-pubkey", // Replace with actual wallet public key
//         }),
//       });

//       if (!response.ok) {
//         throw new Error("Failed to complete purchase");
//       }

//       setIsPurchasing(false);
//       setIsSuccess(true);

//       // Redirect after success
//       setTimeout(() => {
//         router.push("/buyer/purchases");
//       }, 2000);
//     } catch (error: any) {
//       setIsPurchasing(false);
//       setPurchaseError(error.message || "An error occurred during the purchase");
//     }
//   };

//   const getDeviceIcon = (type: string | undefined) => {
//     switch (type?.toLowerCase()) {
//       case "temperature":
//         return <ThermometerSun className="h-5 w-5" />;
//       case "humidity":
//         return <Droplets className="h-5 w-5" />;
//       case "air-quality":
//       case "wind":
//         return <Wind className="h-5 w-5" />;
//       case "soil-moisture":
//         return <Droplets className="h-5 w-5" />;
//       default:
//         return <BarChart3 className="h-5 w-5" />;
//     }
//   };

//   if (listingsLoading || !listing) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
//           <div className="text-center">
//             <RotateCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
//             <p>Loading listing details...</p>
//           </div>
//         </div>
//       </main>
//     );
//   }

//   if (listingsError) {
//     return (
//       <main className="min-h-screen bg-background">
//         <Navbar />
//         <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
//           <div className="text-center">
//             <p className="text-red-500">Error loading listing details. Please try again later.</p>
//           </div>
//         </div>
//       </main>
//     );
//   }

//   const title = listing.deviceMetadata?.deviceName || listing.deviceId;
//   const location = listing.deviceMetadata?.location
//     ? `${listing.deviceMetadata.location.latitude}, ${listing.deviceMetadata.location.longitude}`
//     : "Unknown";
//   const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
//   const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
//   const verified = !!listing.txSignature;

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />

//       <div className="container mx-auto px-4 pt-24 pb-16">
//         <div className="flex items-center mb-8">
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={() => router.push("/buyer/marketplace")}
//             className="mr-4"
//           >
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back to Marketplace
//           </Button>

//           <div>
//             <h1 className="text-3xl font-bold">Purchase Data</h1>
//             <p className="text-muted-foreground">Review and buy IoT data</p>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* Listing Details */}
//           <div className="lg:col-span-2">
//             <Card>
//               <CardHeader>
//                 <div className="flex justify-between items-start">
//                   <div>
//                     <CardTitle className="text-2xl">{title}</CardTitle>
//                     <CardDescription className="flex items-center mt-1">
//                       <MapPin className="h-3 w-3 mr-1" />
//                       {location}
//                     </CardDescription>
//                   </div>

//                   <div className="flex items-center gap-2">
//                     {verified && (
//                       <Badge
//                         variant="outline"
//                         className="bg-green-500/10 text-green-500 border-green-500/20"
//                       >
//                         <CheckCircle className="h-3 w-3 mr-1" />
//                         Verified
//                       </Badge>
//                     )}
//                   </div>
//                 </div>
//               </CardHeader>

//               <CardContent className="space-y-6">
//                 <div className="flex items-center gap-3">
//                   <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
//                     {getDeviceIcon(dataType)}
//                   </div>
//                   <div>
//                     <p className="font-medium">
//                       {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Sensor
//                     </p>
//                     <div className="flex items-center text-sm text-muted-foreground">
//                       <Star className="h-4 w-4 text-yellow-500 mr-1" />
//                       <span>4.5 rating</span>
//                       <span className="mx-2">•</span>
//                       <Clock className="h-4 w-4 mr-1" />
//                       <span>Updated recently</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div>
//                   <h3 className="text-lg font-medium mb-2">Description</h3>
//                   <p className="text-muted-foreground">
//                     Data from {title} ({dataType})
//                   </p>
//                 </div>

//                 <Tabs defaultValue="preview" className="w-full">
//                   <TabsList className="grid w-full grid-cols-2">
//                     <TabsTrigger value="preview">Data Preview</TabsTrigger>
//                     <TabsTrigger value="details">Technical Details</TabsTrigger>
//                   </TabsList>

//                   <TabsContent value="preview" className="space-y-4 pt-4">
//                     {previewLoading ? (
//                       <div className="rounded-lg overflow-hidden border border-muted h-[250px] flex items-center justify-center bg-muted/30">
//                         <div className="text-center p-4">
//                           <p className="text-muted-foreground mb-2">Loading preview...</p>
//                         </div>
//                       </div>
//                     ) : previewError || !reading ? (
//                       <div className="rounded-lg overflow-hidden border border-muted h-[250px] flex items-center justify-center bg-muted/30">
//                         <div className="text-center p-4">
//                           <p className="text-muted-foreground mb-2">No preview available for this listing</p>
//                           <p className="text-sm text-muted-foreground">Purchase to access the full dataset</p>
//                         </div>
//                       </div>
//                     ) : (
//                       <div className="rounded-lg overflow-hidden border border-primary/20 h-[250px] relative">
//                         <div className="absolute inset-0 grid-bg opacity-70"></div>
//                         <div className="absolute inset-0 p-4">
//                           <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20 h-full overflow-auto">
//                             <h4 className="text-sm font-medium mb-2">Sample Data (Limited Preview)</h4>
//                             <pre className="text-xs font-mono">
//                               {JSON.stringify(reading, null, 2).slice(0, 500)}...
//                             </pre>
//                           </div>
//                         </div>
//                       </div>
//                     )}
//                   </TabsContent>

//                   <TabsContent value="details" className="space-y-4 pt-4">
//                     <div className="grid grid-cols-2 gap-4">
//                       <div>
//                         <h4 className="text-sm font-medium text-muted-foreground">Data Format</h4>
//                         <p className="font-medium">JSON</p>
//                       </div>
//                       <div>
//                         <h4 className="text-sm font-medium text-muted-foreground">Update Frequency</h4>
//                         <p className="font-medium">
//                           {frequency === "hourly"
//                             ? "Every hour"
//                             : frequency === "daily"
//                               ? "Every day"
//                               : frequency === "weekly"
//                                 ? "Weekly"
//                                 : "Monthly"}
//                         </p>
//                       </div>
//                       <div>
//                         <h4 className="text-sm font-medium text-muted-foreground">Historical Data</h4>
//                         <p className="font-medium">3 months included</p>
//                       </div>
//                       <div>
//                         <h4 className="text-sm font-medium text-muted-foreground">Access Method</h4>
//                         <p className="font-medium">API + Direct Download</p>
//                       </div>
//                     </div>

//                     <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
//                       <p className="text-sm text-muted-foreground">
//                         <span className="text-primary font-medium">Note:</span> After purchase, you'll receive access to
//                         the full dataset and API credentials for real-time updates.
//                       </p>
//                     </div>
//                   </TabsContent>
//                 </Tabs>

//                 <div>
//                   <h3 className="text-lg font-medium mb-2">Seller Information</h3>
//                   <div className="flex items-center gap-3">
//                     <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
//                       <span className="text-primary-foreground font-bold">S</span>
//                     </div>
//                     <div>
//                       <p className="font-medium">
//                         Seller ID: {listing.sellerPubkey.slice(0, 6)}...{listing.sellerPubkey.slice(-4)}
//                       </p>
//                       <div className="flex items-center text-sm text-muted-foreground">
//                         <Star className="h-4 w-4 text-yellow-500 mr-1" />
//                         <span>4.5 average rating</span>
//                         <span className="mx-2">•</span>
//                         <span>Active since {new Date(listing.createdAt).getFullYear()}</span>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Purchase Card */}
//           <div>
//             <Card className="sticky top-24">
//               <CardHeader>
//                 <CardTitle>Purchase Summary</CardTitle>
//                 <CardDescription>Review your order details</CardDescription>
//               </CardHeader>

//               <CardContent className="space-y-4">
//                 <div className="p-4 bg-muted rounded-lg">
//                   <div className="flex justify-between items-center mb-2">
//                     <span className="text-sm">Data Subscription:</span>
//                     <span className="font-medium">{title}</span>
//                   </div>
//                   <div className="flex justify-between items-center mb-2">
//                     <span className="text-sm">Price:</span>
//                     <div>
//                       <span className="font-bold">{listing.pricePerUnit} SOL</span>
//                       <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
//                     </div>
//                   </div>
//                   <div className="flex justify-between items-center mb-2">
//                     <span className="text-sm">Network Fee:</span>
//                     <span className="font-medium">0.000005 SOL</span>
//                   </div>
//                   <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
//                     <span className="text-sm font-medium">Total:</span>
//                     <span className="font-bold">{(listing.pricePerUnit + 0.000005).toFixed(6)} SOL</span>
//                   </div>
//                 </div>

//                 <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
//                   <h4 className="text-sm font-medium mb-2">What You'll Get:</h4>
//                   <ul className="text-sm text-muted-foreground space-y-1">
//                     <li className="flex items-start">
//                       <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
//                       Full access to the dataset
//                     </li>
//                     <li className="flex items-start">
//                       <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
//                       API access for real-time updates
//                     </li>
//                     <li className="flex items-start">
//                       <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
//                       {frequency === "hourly"
//                         ? "Hourly"
//                         : frequency === "daily"
//                           ? "Daily"
//                           : frequency === "weekly"
//                             ? "Weekly"
//                             : "Monthly"}{" "}
//                       updates
//                     </li>
//                     <li className="flex items-start">
//                       <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
//                       Blockchain-verified authenticity
//                     </li>
//                   </ul>
//                 </div>

//                 {purchaseError && (
//                   <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
//                     <p className="text-sm text-red-500">{purchaseError}</p>
//                   </div>
//                 )}
//               </CardContent>

//               <CardFooter>
//                 <Button
//                   onClick={handlePurchase}
//                   disabled={isPurchasing || isSuccess}
//                   className={`w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${
//                     isSuccess ? "bg-green-500" : ""
//                   }`}
//                 >
//                   {isPurchasing ? (
//                     <>
//                       <RotateCw className="mr-2 h-4 w-4 animate-spin" />
//                       Processing...
//                     </>
//                   ) : isSuccess ? (
//                     <>
//                       <CheckCircle className="mr-2 h-4 w-4" />
//                       Purchase Successful
//                     </>
//                   ) : (
//                     "Buy Now"
//                   )}
//                 </Button>
//               </CardFooter>
//             </Card>
//           </div>
//         </div>
//       </div>

//       {/* Confirmation Dialog */}
//       <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle>Confirm Purchase</DialogTitle>
//             <DialogDescription>
//               You are about to purchase this data subscription using your Solana wallet
//             </DialogDescription>
//           </DialogHeader>

//           <div className="space-y-4 py-4">
//             <div className="bg-muted p-4 rounded-lg">
//               <div className="flex justify-between items-center mb-2">
//                 <span className="text-sm">Data:</span>
//                 <span className="font-medium">{title}</span>
//               </div>
//               <div className="flex justify-between items-center mb-2">
//                 <span className="text-sm">Price:</span>
//                 <div>
//                   <span className="font-bold">{listing.pricePerUnit} usdc</span>
//                   <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
//                 </div>
//               </div>
//               <div className="flex justify-between items-center mb-2">
//                 <span className="text-sm">Network Fee:</span>
//                 <span className="font-medium">0.000005 SOL</span>
//               </div>
//               <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
//                 <span className="text-sm font-medium">Total:</span>
//                 <span className="font-bold">{(listing.pricePerUnit + 0.000005).toFixed(6)} SOL</span>
//               </div>
//             </div>

//             <p className="text-sm text-muted-foreground">
//               This transaction will be recorded on the Solana blockchain. After purchase, you'll receive immediate
//               access to the data.
//             </p>
//           </div>

//           <DialogFooter>
//             <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
//               Cancel
//             </Button>
//             <Button onClick={confirmPurchase} className="bg-primary hover:bg-primary/90">
//               Confirm Purchase
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </main>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useLatestReading } from "@/hooks/useLatestReading";
import { usePurchaseListing } from "@/hooks/usePurchaseListing";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Clock,
  Star,
  RotateCw,
  ThermometerSun,
  Droplets,
  Wind,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Listing } from "@/hooks/types/listing";

export default function PurchaseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, userType } = useWalletContext();
  const { listings, isLoading: listingsLoading, isError: listingsError } = useActiveListings();
  const { preparePurchase, finalizePurchase, isPreparing, isFinalizing, error: purchaseErrorHook } = usePurchaseListing();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unitsRequested, setUnitsRequested] = useState<number>(1);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Fetch preview data for the specific listing
  const deviceId = listing?.deviceId || "";
  const { reading, isLoading: previewLoading, isError: previewError } = useLatestReading(deviceId);

  useEffect(() => {
    console.log("PurchaseClient: useEffect triggered", { connected, userType, searchParams });
    if (!connected) {
      console.log("PurchaseClient: Not connected, redirecting to /");
      router.push("/");
      return;
    }

    if (userType !== "buyer") {
      console.log("PurchaseClient: User is not a buyer, redirecting to /");
      router.push("/");
      return;
    }

    if (!searchParams) {
      console.log("PurchaseClient: searchParams is null, redirecting to /buyer/marketplace");
      router.push("/buyer/marketplace");
      return;
    }
    const listingId = searchParams.get("id");
    console.log("PurchaseClient: Extracted listingId from searchParams", { listingId });
    if (!listingId) {
      console.log("PurchaseClient: No listingId found, redirecting to /buyer/marketplace");
      router.push("/buyer/marketplace");
      return;
    }

    if (!listingsLoading && !listingsError && listings) {
      console.log("PurchaseClient: Listings loaded", { listings: listings.map(l => ({ _id: l._id, listingId: l.listingId })) });
      const foundListing = listings.find((item) => item._id === listingId);
      console.log("PurchaseClient: Searched for listing", { listingId, foundListing });
      if (!foundListing) {
        console.log("PurchaseClient: Listing not found in active listings, redirecting to /buyer/marketplace");
        router.push("/buyer/marketplace");
        return;
      }
      setListing(foundListing);
      console.log("PurchaseClient: Set listing", { listing: foundListing });
    }
  }, [connected, userType, router, searchParams, listings, listingsLoading, listingsError]);

  const handlePurchase = () => {
    console.log("PurchaseClient: handlePurchase called", { listingId: listing?._id, unitsRequested });
    setPurchaseError(null); // Clear previous errors
    setShowConfirmDialog(true);
  };

  const confirmPurchase = async () => {
    if (!listing) {
      console.log("PurchaseClient: confirmPurchase called but no listing");
      return;
    }
    console.log("PurchaseClient: confirmPurchase called", { listingId: listing.listingId, unitsRequested });

    if (unitsRequested > listing.totalDataUnits) {
      console.log("PurchaseClient: Invalid unitsRequested", { unitsRequested, totalDataUnits: listing.totalDataUnits });
      setPurchaseError(`Cannot request more than ${listing.totalDataUnits} units`);
      return;
    }

    setShowConfirmDialog(false);

    try {
      console.log("PurchaseClient: Calling preparePurchase", { listingId: listing.listingId, unitsRequested });
      await preparePurchase(listing.listingId, unitsRequested);
      console.log("PurchaseClient: preparePurchase succeeded, calling finalizePurchase");
      const { txSignature } = await finalizePurchase(listing.listingId);
      console.log("PurchaseClient: finalizePurchase succeeded", { txSignature });
      setIsSuccess(true);

      // Redirect after success
      setTimeout(() => {
        console.log("PurchaseClient: Redirecting to /buyer/purchases");
        router.push("/buyer/purchases");
      }, 2000);
    } catch (error: any) {
      console.log("PurchaseClient: Purchase failed", { error: error.message });
      setPurchaseError(error.message || "Failed to complete purchase");
    }
  };

  const getDeviceIcon = (type: string | undefined) => {
    switch (type?.toLowerCase()) {
      case "temperature":
        return <ThermometerSun className="h-5 w-5" />;
      case "humidity":
        return <Droplets className="h-5 w-5" />;
      case "air-quality":
      case "wind":
        return <Wind className="h-5 w-5" />;
      case "soil-moisture":
        return <Droplets className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  if (listingsLoading || !listing) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <RotateCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Loading listing details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (listingsError) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500">Error loading listing details. Please try again later.</p>
          </div>
        </div>
      </main>
    );
  }

  const title = listing.deviceMetadata?.deviceName || listing.deviceId;
  const location = listing.deviceMetadata?.location
    ? `${listing.deviceMetadata.location.latitude}, ${listing.deviceMetadata.location.longitude}`
    : "Unknown";
  const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
  const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
  const verified = !!listing.txSignature;

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/buyer/marketplace")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Purchase Data</h1>
            <p className="text-muted-foreground">Review and buy IoT data</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      {location}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {verified && (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500 border-green-500/20"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {getDeviceIcon(dataType)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Sensor
                    </p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span>4.5 rating</span>
                      <span className="mx-2">•</span>
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Updated recently</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground">
                    Data from {title} ({dataType})
                  </p>
                </div>
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">Data Preview</TabsTrigger>
                    <TabsTrigger value="details">Technical Details</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="space-y-4 pt-4">
                    {previewLoading ? (
                      <div className="rounded-lg overflow-hidden border border-muted h-[250px] flex items-center justify-center bg-muted/30">
                        <div className="text-center p-4">
                          <p className="text-muted-foreground mb-2">Loading preview...</p>
                        </div>
                      </div>
                    ) : previewError || !reading ? (
                      <div className="rounded-lg overflow-hidden border border-muted h-[250px] flex items-center justify-center bg-muted/30">
                        <div className="text-center p-4">
                          <p className="text-muted-foreground mb-2">No preview available for this listing</p>
                          <p className="text-sm text-muted-foreground">Purchase to access the full dataset</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-primary/20 h-[250px] relative">
                        <div className="absolute inset-0 grid-bg opacity-70"></div>
                        <div className="absolute inset-0 p-4">
                          <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20 h-full overflow-auto">
                            <h4 className="text-sm font-medium mb-2">Sample Data (Limited Preview)</h4>
                            <pre className="text-xs font-mono">
                              {JSON.stringify(reading, null, 2).slice(0, 500)}...
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Data Format</h4>
                        <p className="font-medium">JSON</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Update Frequency</h4>
                        <p className="font-medium">
                          {frequency === "hourly"
                            ? "Every hour"
                            : frequency === "daily"
                              ? "Every day"
                              : frequency === "weekly"
                                ? "Weekly"
                                : "Monthly"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Historical Data</h4>
                        <p className="font-medium">3 months included</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Access Method</h4>
                        <p className="font-medium">API + Direct Download</p>
                      </div>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        <span className="text-primary font-medium">Note:</span> After purchase, you'll receive access to
                        the full dataset and API credentials for real-time updates.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
                <div>
                  <h3 className="text-lg font-medium mb-2">Seller Information</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                      <span className="text-primary-foreground font-bold">S</span>
                    </div>
                    <div>
                      <p className="font-medium">
                        Seller ID: {listing.sellerPubkey.slice(0, 6)}...{listing.sellerPubkey.slice(-4)}
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                        <span>4.5 average rating</span>
                        <span className="mx-2">•</span>
                        <span>Active since {new Date(listing.createdAt).getFullYear()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Purchase Summary</CardTitle>
                <CardDescription>Review your order details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Data Subscription:</span>
                    <span className="font-medium">{title}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Price per Unit:</span>
                    <div>
                      <span className="font-bold">{listing.pricePerUnit} USDC</span>
                      <span className="text-xs text-muted-foreground ml-1">/unit</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Network Fee:</span>
                    <span className="font-medium">0.000005 SOL</span>
                  </div>
                </div>
                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                  <h4 className="text-sm font-medium mb-2">What You'll Get:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                      Full access to the dataset
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                      API access for real-time updates
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                      {frequency === "hourly"
                        ? "Hourly"
                        : frequency === "daily"
                          ? "Daily"
                          : frequency === "weekly"
                            ? "Weekly"
                            : "Monthly"}{" "}
                      updates
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                      Blockchain-verified authenticity
                    </li>
                  </ul>
                </div>
                {(purchaseError || purchaseErrorHook) && (
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                    <p className="text-sm text-red-500">{purchaseError || purchaseErrorHook}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handlePurchase}
                  disabled={isPreparing || isFinalizing || isSuccess}
                  className={`w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${
                    isSuccess ? "bg-green-500" : ""
                  }`}
                >
                  {isPreparing || isFinalizing ? (
                    <>
                      <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Purchase Successful
                    </>
                  ) : (
                    "Buy Now"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You are about to purchase this data subscription using your Solana wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Data:</span>
                <span className="font-medium">{title}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Price per Unit:</span>
                <div>
                  <span className="font-bold">{listing.pricePerUnit} USDC</span>
                  <span className="text-xs text-muted-foreground ml-1">/unit</span>
                </div>
              </div>
              <div className="mb-2">
                <Label htmlFor="unitsRequested" className="text-sm">
                  Units Requested
                </Label>
                <Input
                  id="unitsRequested"
                  type="number"
                  min="1"
                  max={listing.totalDataUnits}
                  value={unitsRequested}
                  onChange={(e) => setUnitsRequested(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Total Price:</span>
                <span className="font-bold">{(listing.pricePerUnit * unitsRequested).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Network Fee:</span>
                <span className="font-medium">0.000005 SOL</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This transaction will be recorded on the Solana blockchain. After purchase, you'll receive immediate
              access to the data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPurchase}
              className="bg-primary hover:bg-primary/90"
              disabled={isPreparing || isFinalizing}
            >
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}