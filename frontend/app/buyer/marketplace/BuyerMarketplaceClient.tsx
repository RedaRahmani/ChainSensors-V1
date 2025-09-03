// // app/buyer/marketplace/BuyerMarketplaceClient.tsx
// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
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
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import { Slider } from "@/components/ui/slider";
// import { Switch } from "@/components/ui/switch";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Search,
//   Filter,
//   MapPin,
//   Tag,
//   Clock,
//   Star,
//   CheckCircle,
//   BarChart3,
//   ThermometerSun,
//   Droplets,
//   Wind,
// } from "lucide-react";
// import { Listing } from "@/hooks/types/listing";

// export default function BuyerMarketplaceClient() {
//   const router = useRouter();
//   const { connected, userType } = useWalletContext();
//   const { listings: allListings, isLoading, isError } = useActiveListings();

//   const [searchTerm, setSearchTerm] = useState("");
//   const [priceRange, setPriceRange] = useState([0, 15]);
//   const [selectedType, setSelectedType] = useState("");
//   const [selectedUnit, setSelectedUnit] = useState("");
//   const [verifiedOnly, setVerifiedOnly] = useState(false);
//   const [previewOnly, setPreviewOnly] = useState(false);
//   const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
//   const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

//   const firstDeviceId = allListings[0]?.deviceId ?? "";
//   const {
//     reading,
//     isLoading: previewLoading,
//     isError: previewError,
//   } = useLatestReading(firstDeviceId);

//   // Redirect if no wallet or wrong role
//   useEffect(() => {
//     if (!connected || userType !== "buyer") {
//       router.push("/");
//     }
//   }, [connected, userType, router]);

//   // Build filteredListings when data or filters change
//   useEffect(() => {
//     if (isLoading || isError) return;
//     const filtered = allListings.filter((listing) => {
//       const title = listing.deviceMetadata?.deviceName ?? listing.deviceId;
//       const location = listing.deviceMetadata?.location
//         ? `${listing.deviceMetadata.location.latitude}, ${listing.deviceMetadata.location.longitude}`
//         : "Unknown";
//       const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type ?? "Generic";
//       const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency ?? "unit";

//       console.log("Filtering listing:", listing.listingId, "Price:", listing.pricePerUnit);

//       if (
//         searchTerm &&
//         ![title, location].some((x) => x.toLowerCase().includes(searchTerm.toLowerCase()))
//       ) {
//         return false;
//       }

//       if (listing.pricePerUnit < priceRange[0] || listing.pricePerUnit > priceRange[1]) {
//         console.log("Excluded by price:", listing.listingId, listing.pricePerUnit);
//         return false;
//       }

//       if (selectedType && dataType.toLowerCase() !== selectedType.toLowerCase()) {
//         return false;
//       }

//       if (selectedUnit && selectedUnit !== "any" && frequency.toLowerCase() !== selectedUnit.toLowerCase()) {
//         return false;
//       }

//       if (verifiedOnly && !listing.txSignature) {
//         return false;
//       }

//       if (previewOnly && !listing.dataCid) {
//         return false;
//       }

//       return true;
//     });
//     console.log("Filtered listings count:", filtered.length);
//     setFilteredListings(filtered);
//   }, [allListings, isLoading, isError, searchTerm, priceRange, selectedType, selectedUnit, verifiedOnly, previewOnly]);

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

//   if (isLoading)
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center">
//         Loading...
//       </div>
//     );
//   if (isError)
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center">
//         Error loading listings. Please try again later.
//       </div>
//     );

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />

//       <div className="container mx-auto px-4 pt-24 pb-16">
//         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
//           <div>
//             <h1 className="text-3xl font-bold">Data Marketplace</h1>
//             <p className="text-muted-foreground">Browse and purchase IoT data streams</p>
//           </div>

//           <div className="flex gap-4 mt-4 md:mt-0">
//             <Button
//               variant="outline"
//               className="border-primary/50 text-primary hover:text-primary hover:bg-primary/10"
//               onClick={() => router.push("/buyer/purchases")}
//             >
//               My Purchases
//             </Button>
//           </div>
//         </div>

//         {/* Search and Filters */}
//         <div className="mb-8">
//           <div className="flex flex-col md:flex-row gap-4 mb-4">
//             <div className="relative flex-1">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
//               <Input
//                 placeholder="Search for data listings..."
//                 className="pl-10"
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//               />
//             </div>

//             <div className="flex gap-2">
//               <Button
//                 variant={viewMode === "grid" ? "default" : "outline"}
//                 size="icon"
//                 onClick={() => setViewMode("grid")}
//                 className={viewMode === "grid" ? "bg-primary hover:bg-primary/90" : ""}
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   width="16"
//                   height="16"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                 >
//                   <rect x="3" y="3" width="7" height="7" />
//                   <rect x="14" y="3" width="7" height="7" />
//                   <rect x="3" y="14" width="7" height="7" />
//                   <rect x="14" y="14" width="7" height="7" />
//                 </svg>
//               </Button>
//               <Button
//                 variant={viewMode === "list" ? "default" : "outline"}
//                 size="icon"
//                 onClick={() => setViewMode("list")}
//                 className={viewMode === "list" ? "bg-secondary hover:bg-secondary/90" : ""}
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   width="16"
//                   height="16"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                 >
//                   <line x1="3" y1="6" x2="21" y2="6" />
//                   <line x1="3" y1="12" x2="21" y2="12" />
//                   <line x1="3" y1="18" x2="21" y2="18" />
//                 </svg>
//               </Button>
//             </div>
//           </div>

//           <Card>
//             <CardContent className="p-4">
//               <div className="flex flex-col md:flex-row gap-6">
//                 <div className="space-y-4 flex-1">
//                   <div>
//                     <Label className="text-sm font-medium flex items-center">
//                       <Filter className="h-4 w-4 mr-2" />
//                       Price Range (usdc)
//                     </Label>
//                     <div className="pt-4 px-2">
//                       <Slider min={0} max={15} step={0.1} value={priceRange} onValueChange={setPriceRange} />
//                       <div className="flex justify-between mt-2 text-xs text-muted-foreground">
//                         <span>{priceRange[0]} usdc</span>
//                         <span>{priceRange[1]} usdc</span>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="space-y-4 flex-1">
//                   <div className="grid grid-cols-2 gap-4">
//                     <div>
//                       <Label htmlFor="device-type">Device Type</Label>
//                       <Select value={selectedType} onValueChange={setSelectedType}>
//                         <SelectTrigger id="device-type">
//                           <SelectValue placeholder="Any type" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           <SelectItem value="any">Any type</SelectItem>
//                           <SelectItem value="temperature">Temperature</SelectItem>
//                           <SelectItem value="humidity">Humidity</SelectItem>
//                           <SelectItem value="air-quality">Air Quality</SelectItem>
//                           <SelectItem value="soil-moisture">Soil Moisture</SelectItem>
//                           <SelectItem value="wind">Wind</SelectItem>
//                         </SelectContent>
//                       </Select>
//                     </div>

//                     <div>
//                       <Label htmlFor="pricing-unit">Pricing Unit</Label>
//                       <Select value={selectedUnit} onValueChange={setSelectedUnit}>
//                         <SelectTrigger id="pricing-unit">
//                           <SelectValue placeholder="Any unit" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           <SelectItem value="any">Any unit</SelectItem>
//                           <SelectItem value="hourly">Hourly</SelectItem>
//                           <SelectItem value="daily">Daily</SelectItem>
//                           <SelectItem value="weekly">Weekly</SelectItem>
//                           <SelectItem value="monthly">Monthly</SelectItem>
//                         </SelectContent>
//                       </Select>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="space-y-4 flex-1">
//                   <div className="grid grid-cols-2 gap-4">
//                     <div className="flex items-center space-x-2">
//                       <Switch id="verified-only" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
//                       <Label htmlFor="verified-only" className="text-sm cursor-pointer">
//                         Verified Only
//                       </Label>
//                     </div>

//                     <div className="flex items-center space-x-2">
//                       <Switch id="preview-only" checked={previewOnly} onCheckedChange={setPreviewOnly} />
//                       <Label htmlFor="preview-only" className="text-sm cursor-pointer">
//                         Preview Available
//                       </Label>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Results Count */}
//         <div className="flex justify-between items-center mb-6">
//           <p className="text-sm text-muted-foreground">Showing {filteredListings.length} results</p>

//           <Select defaultValue="newest">
//             <SelectTrigger className="w-[180px]">
//               <SelectValue placeholder="Sort by" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="newest">Newest First</SelectItem>
//               <SelectItem value="price-low">Price: Low to High</SelectItem>
//               <SelectItem value="price-high">Price: High to Low</SelectItem>
//               <SelectItem value="rating">Highest Rated</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         {/* Listings */}
//         {viewMode === "grid" ? (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {filteredListings.map((listing) => {
//               const title = listing.deviceMetadata?.deviceName || listing.deviceId;
//               const location = listing.deviceMetadata?.location
//                 ? `${listing.deviceMetadata.location.latitude}, ${listing.deviceMetadata.location.longitude}`
//                 : "Unknown";
//               const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
//               const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
//               const verified = !!listing.txSignature;

//               return (
//                 <Card
//                   key={listing._id}
//                   className="overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-muted"
//                 >
//                   <CardHeader className="p-4 pb-2">
//                     <div className="flex justify-between items-start">
//                       <CardTitle className="text-lg">{title}</CardTitle>
//                       <div className="flex items-center">
//                         {verified && (
//                           <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
//                             <CheckCircle className="h-3 w-3 mr-1" />
//                             Verified
//                           </Badge>
//                         )}
//                       </div>
//                     </div>
//                     <CardDescription className="flex items-center mt-1">
//                       <MapPin className="h-3 w-3 mr-1" />
//                       {location}
//                     </CardDescription>
//                   </CardHeader>
//                   <CardContent className="p-4 pt-2">
//                     <div className="flex items-center gap-2 mb-2">
//                       <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
//                         {getDeviceIcon(dataType)}
//                       </div>
//                       <span className="text-sm">
//                         {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
//                       </span>
//                     </div>

//                     <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
//                       Data from {title} ({dataType})
//                     </p>

//                     {previewLoading ? (
//                       <p className="text-sm text-muted-foreground">Loading preview...</p>
//                     ) : previewError || !reading ? (
//                       <p className="text-sm text-muted-foreground">No preview available</p>
//                     ) : (
//                       <div className="text-sm text-muted-foreground">
//                         Preview: {JSON.stringify(reading).slice(0, 50)}...
//                       </div>
//                     )}

//                     <div className="flex justify-between items-center mt-4">
//                       <div className="flex items-center">
//                         <Star className="h-4 w-4 text-yellow-500 mr-1" />
//                         <span className="text-sm">4.5</span>
//                       </div>

//                       <div className="flex items-center">
//                         <Tag className="h-4 w-4 text-primary mr-1" />
//                         <span className="text-sm font-medium">{listing.pricePerUnit} usdc</span>
//                         <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
//                       </div>
//                     </div>
//                   </CardContent>
//                   <CardFooter className="p-4 pt-0 flex justify-between">
//                     {listing.dataCid && (
//                       <Button variant="outline" size="sm" className="text-xs">
//                         Preview Data
//                       </Button>
//                     )}
//                     <Button
//                       size="sm"
//                       className="ml-auto bg-secondary hover:bg-secondary/90"
//                       onClick={() => router.push(`/buyer/purchase?id=${listing._id}`)}
//                     >
//                       Buy Now
//                     </Button>
//                   </CardFooter>
//                 </Card>
//               );
//             })}
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {filteredListings.map((listing) => {
//               const title = listing.deviceMetadata?.deviceName || listing.deviceId;
//               const location = listing.deviceMetadata?.location
//                 ? `${listing.deviceMetadata.location.latitude}, ${listing.deviceMetadata.location.longitude}`
//                 : "Unknown";
//               const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
//               const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
//               const verified = !!listing.txSignature;

//               return (
//                 <Card
//                   key={listing._id}
//                   className="overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-muted"
//                 >
//                   <div className="flex flex-col md:flex-row">
//                     <div className="p-4 md:w-2/3">
//                       <div className="flex justify-between items-start">
//                         <div>
//                           <h3 className="text-lg font-bold">{title}</h3>
//                           <div className="flex items-center text-sm text-muted-foreground mt-1">
//                             <MapPin className="h-3 w-3 mr-1" />
//                             {location}
//                             <span className="mx-2">•</span>
//                             <div className="flex items-center">
//                               {getDeviceIcon(dataType)}
//                               <span className="ml-1">
//                                 {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
//                               </span>
//                             </div>
//                           </div>
//                         </div>

//                         <div className="flex items-center gap-2">
//                           {verified && (
//                             <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
//                               <CheckCircle className="h-3 w-3 mr-1" />
//                               Verified
//                             </Badge>
//                           )}
//                           {listing.dataCid && (
//                             <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
//                               Preview
//                             </Badge>
//                           )}
//                         </div>
//                       </div>

//                       <p className="text-sm text-muted-foreground my-4">
//                         Data from {title} ({dataType})
//                       </p>

//                       {previewLoading ? (
//                         <p className="text-sm text-muted-foreground">Loading preview...</p>
//                       ) : previewError || !reading ? (
//                         <p className="text-sm text-muted-foreground">No preview available</p>
//                       ) : (
//                         <div className="text-sm text-muted-foreground">
//                           Preview: {JSON.stringify(reading).slice(0, 50)}...
//                         </div>
//                       )}

//                       <div className="flex items-center mt-4">
//                         <Star className="h-4 w-4 text-yellow-500 mr-1" />
//                         <span className="text-sm">4.5</span>
//                         <Clock className="h-4 w-4 text-muted-foreground ml-4 mr-1" />
//                         <span className="text-sm text-muted-foreground">Updated recently</span>
//                       </div>
//                     </div>

//                     <div className="p-4 md:w-1/3 bg-muted/30 flex flex-col justify-between">
//                       <div>
//                         <div className="flex justify-between items-center mb-4">
//                           <span className="text-sm text-muted-foreground">Price:</span>
//                           <div className="text-right">
//                             <span className="text-xl font-bold">{listing.pricePerUnit} usdc</span>
//                             <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
//                           </div>
//                         </div>

//                         <div className="text-sm text-muted-foreground mb-6">
//                           <p>Seller: {listing.sellerPubkey.slice(0, 6)}...{listing.sellerPubkey.slice(-4)}</p>
//                         </div>
//                       </div>

//                       <div className="flex flex-col gap-2">
//                         {listing.dataCid && (
//                           <Button variant="outline" size="sm">
//                             Preview Data
//                           </Button>
//                         )}
//                         <Button
//                           className="bg-secondary hover:bg-secondary/90"
//                           onClick={() => router.push(`/buyer/purchase?id=${listing._id}`)}
//                         >
//                           Buy Now
//                         </Button>
//                       </div>
//                     </div>
//                   </div>
//                 </Card>
//               );
//             })}
//           </div>
//         )}

//         {filteredListings.length === 0 && (
//           <div className="text-center py-12">
//             <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
//               <Search className="h-8 w-8 text-muted-foreground" />
//             </div>
//             <h3 className="text-lg font-medium mb-2">No listings found</h3>
//             <p className="text-muted-foreground max-w-md mx-auto">
//               Try adjusting your filters or search terms to find what you're looking for.
//             </p>
//           </div>
//         )}
//       </div>
//     </main>
//   );
// }

// app/buyer/marketplace/BuyerMarketplaceClient.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useLatestReading } from "@/hooks/useLatestReading";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  MapPin,
  Tag,
  Clock,
  Star,
  CheckCircle,
  BarChart3,
  ThermometerSun,
  Droplets,
  Wind,
} from "lucide-react";
import { Listing } from "@/hooks/types/listing";
import { getFakeLocationForDevice, formatLocationForDisplay } from "@/lib/fake-locations";

// === Location helpers (object or "lat,lon" string) ===
const parseLocation = (meta?: any): { lat: number | null; lon: number | null } => {
  if (!meta || !meta.location) return { lat: null, lon: null };
  const loc = meta.location;

  if (typeof loc === "object" && loc !== null) {
    const lat = typeof loc.latitude === "number" ? loc.latitude : Number(loc.latitude);
    const lon = typeof loc.longitude === "number" ? loc.longitude : Number(loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  if (typeof loc === "string") {
    const [a, b] = loc.split(",").map((s) => Number(String(s).trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lon: b };
  }
  return { lat: null, lon: null };
};

const getDisplayLocation = (listing: Listing): { 
  displayText: string; 
  lat: number | null; 
  lon: number | null; 
  isFake: boolean;
} => {
  const { lat, lon } = parseLocation(listing.deviceMetadata);
  
  if (lat != null && lon != null) {
    return {
      displayText: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
      isFake: false
    };
  }
  
  // Use fake location based on device ID for consistency
  const fakeLocation = getFakeLocationForDevice(listing.deviceId);
  return {
    displayText: formatLocationForDisplay(fakeLocation),
    lat: fakeLocation.latitude,
    lon: fakeLocation.longitude,
    isFake: true
  };
};

export default function BuyerMarketplaceClient() {
  const router = useRouter();
  const { connected, userType } = useWalletContext();
  const { listings: allListings, isLoading, isError } = useActiveListings();

  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState([0, 15]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const firstDeviceId = allListings[0]?.deviceId ?? "";
  const {
    reading,
    isLoading: previewLoading,
    isError: previewError,
  } = useLatestReading(firstDeviceId);

  // Redirect if no wallet or wrong role
  useEffect(() => {
    if (!connected || userType !== "buyer") {
      router.push("/");
    }
  }, [connected, userType, router]);

  // Build filteredListings when data or filters change
  useEffect(() => {
    if (isLoading || isError) return;
    const filtered = allListings.filter((listing) => {
      const title = listing.deviceMetadata?.deviceName ?? listing.deviceId;

      const locationData = getDisplayLocation(listing);
      const locationText = locationData.displayText;

      const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type ?? "Generic";
      const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency ?? "unit";

      if (
        searchTerm &&
        ![title, locationText].some((x) => x.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
        return false;
      }

      if (listing.pricePerUnit < priceRange[0] || listing.pricePerUnit > priceRange[1]) {
        return false;
      }

      if (selectedType && dataType.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      if (selectedUnit && selectedUnit !== "any" && frequency.toLowerCase() !== selectedUnit.toLowerCase()) {
        return false;
      }

      if (verifiedOnly && !listing.txSignature) {
        return false;
      }

      if (previewOnly && !listing.dataCid) {
        return false;
      }

      return true;
    });
    setFilteredListings(filtered);
  }, [allListings, isLoading, isError, searchTerm, priceRange, selectedType, selectedUnit, verifiedOnly, previewOnly]);

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

  if (isLoading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading...
      </div>
    );
  if (isError)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Error loading listings. Please try again later.
      </div>
    );

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Data Marketplace</h1>
            <p className="text-muted-foreground">Browse and purchase IoT data streams</p>
          </div>

          <div className="flex gap-4 mt-4 md:mt-0">
            <Button
              variant="outline"
              className="border-primary/50 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => router.push("/buyer/purchases")}
            >
              My Purchases
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search for data listings..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-primary hover:bg-primary/90" : ""}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-secondary hover:bg-secondary/90" : ""}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="space-y-4 flex-1">
                  <div>
                    <Label className="text-sm font-medium flex items-center">
                      <Filter className="h-4 w-4 mr-2" />
                      Price Range (usdc)
                    </Label>
                    <div className="pt-4 px-2">
                      <Slider min={0} max={15} step={0.1} value={priceRange} onValueChange={setPriceRange} />
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{priceRange[0]} usdc</span>
                        <span>{priceRange[1]} usdc</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="device-type">Device Type</Label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger id="device-type">
                          <SelectValue placeholder="Any type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any type</SelectItem>
                          <SelectItem value="temperature">Temperature</SelectItem>
                          <SelectItem value="humidity">Humidity</SelectItem>
                          <SelectItem value="air-quality">Air Quality</SelectItem>
                          <SelectItem value="soil-moisture">Soil Moisture</SelectItem>
                          <SelectItem value="wind">Wind</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="pricing-unit">Pricing Unit</Label>
                      <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                        <SelectTrigger id="pricing-unit">
                          <SelectValue placeholder="Any unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any unit</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch id="verified-only" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
                      <Label htmlFor="verified-only" className="text-sm cursor-pointer">
                        Verified Only
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch id="preview-only" checked={previewOnly} onCheckedChange={setPreviewOnly} />
                      <Label htmlFor="preview-only" className="text-sm cursor-pointer">
                        Preview Available
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Count */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-muted-foreground">Showing {filteredListings.length} results</p>

          <Select defaultValue="newest">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Listings */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => {
              const title = listing.deviceMetadata?.deviceName || listing.deviceId;
              const locationData = getDisplayLocation(listing);
              const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
              const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
              const verified = !!listing.txSignature;

              return (
                <Card
                  key={listing._id}
                  className="overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-muted"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{title}</CardTitle>
                      <div className="flex items-center">
                        {verified && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      <a
                        href={`https://maps.google.com/?q=${locationData.lat},${locationData.lon}`}
                        target="_blank"
                        className={`underline-offset-2 hover:underline ${
                          locationData.isFake ? 'text-muted-foreground/70 italic' : ''
                        }`}
                        rel="noreferrer"
                        title={locationData.isFake ? 'Simulated location for demo purposes' : 'Real device location'}
                      >
                        {locationData.displayText}
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {getDeviceIcon(dataType)}
                      </div>
                      <span className="text-sm">
                        {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      Data from {title} ({dataType})
                    </p>

                    {previewLoading ? (
                      <p className="text-sm text-muted-foreground">Loading preview...</p>
                    ) : previewError || !reading ? (
                      <p className="text-sm text-muted-foreground">No preview available</p>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Preview: {JSON.stringify(reading).slice(0, 50)}...
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                        <span className="text-sm">4.5</span>
                      </div>

                      <div className="flex items-center">
                        <Tag className="h-4 w-4 text-primary mr-1" />
                        <span className="text-sm font-medium">{listing.pricePerUnit} usdc</span>
                        <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex justify-between">
                    {listing.dataCid && (
                      <Button variant="outline" size="sm" className="text-xs">
                        Preview Data
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="ml-auto bg-secondary hover:bg-secondary/90"
                      onClick={() => router.push(`/buyer/purchase?id=${listing._id}`)}
                    >
                      Buy Now
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => {
              const title = listing.deviceMetadata?.deviceName || listing.deviceId;
              const locationData = getDisplayLocation(listing);
              const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
              const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
              const verified = !!listing.txSignature;

              return (
                <Card
                  key={listing._id}
                  className="overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-muted"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="p-4 md:w-2/3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold">{title}</h3>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <a
                              href={`https://maps.google.com/?q=${locationData.lat},${locationData.lon}`}
                              target="_blank"
                              className={`underline-offset-2 hover:underline ${
                                locationData.isFake ? 'text-muted-foreground/70 italic' : ''
                              }`}
                              rel="noreferrer"
                              title={locationData.isFake ? 'Simulated location for demo purposes' : 'Real device location'}
                            >
                              {locationData.displayText}
                            </a>
                            <span className="mx-2">•</span>
                            <div className="flex items-center">
                              {getDeviceIcon(dataType)}
                              <span className="ml-1">
                                {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {verified && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {listing.dataCid && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              Preview
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground my-4">
                        Data from {title} ({dataType})
                      </p>

                      {previewLoading ? (
                        <p className="text-sm text-muted-foreground">Loading preview...</p>
                      ) : previewError || !reading ? (
                        <p className="text-sm text-muted-foreground">No preview available</p>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Preview: {JSON.stringify(reading).slice(0, 50)}...
                        </div>
                      )}

                      <div className="flex items-center mt-4">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                        <span className="text-sm">4.5</span>
                        <Clock className="h-4 w-4 text-muted-foreground ml-4 mr-1" />
                        <span className="text-sm text-muted-foreground">Updated recently</span>
                      </div>
                    </div>

                    <div className="p-4 md:w-1/3 bg-muted/30 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm text-muted-foreground">Price:</span>
                          <div className="text-right">
                            <span className="text-xl font-bold">{listing.pricePerUnit} usdc</span>
                            <span className="text-xs text-muted-foreground ml-1">/{frequency}</span>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground mb-6">
                          <p>Seller: {listing.sellerPubkey.slice(0, 6)}...{listing.sellerPubkey.slice(-4)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {listing.dataCid && (
                          <Button variant="outline" size="sm">
                            Preview Data
                          </Button>
                        )}
                        <Button
                          className="bg-secondary hover:bg-secondary/90"
                          onClick={() => router.push(`/buyer/purchase?id=${listing._id}`)}
                        >
                          Buy Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {filteredListings.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No listings found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Try adjusting your filters or search terms to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
