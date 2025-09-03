"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useLatestReading } from "@/hooks/useLatestReading";
import { useFakePurchaseListing } from "@/hooks/useFakePurchaseListing";
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
  XCircle,
  AlertTriangle,
  WifiOff,
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
import { getFakeLocationForDevice, formatLocationForDisplay } from "@/lib/fake-locations";

  // Generate realistic quality data with varied tiers including very low quality
  const generateQualityChecks = (deviceId: string) => {
    // Use device ID to ensure consistent quality scores for same device
    const seed = deviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (seed * 9301 + 49297) % 233280 / 233280;
    
    // Define quality tiers with realistic distributions including very low quality
    let qualityTier: 'very-low' | 'low' | 'medium' | 'high';
    let baseScore: number;
    
    if (random < 0.10) {
      // 10% very low quality devices (30-50%)
      qualityTier = 'very-low';
      baseScore = 30 + (random / 0.10) * 20;
    } else if (random < 0.25) {
      // 15% low quality devices (50-75%)
      qualityTier = 'low';
      baseScore = 50 + ((random - 0.10) / 0.15) * 25;
    } else if (random < 0.45) {
      // 20% medium quality devices (75-85%)
      qualityTier = 'medium';
      baseScore = 75 + ((random - 0.25) / 0.20) * 10;
    } else {
      // 55% high quality devices (85-98%)
      qualityTier = 'high';
      baseScore = 85 + ((random - 0.45) / 0.55) * 13;
    }
    
    // Generate individual scores with some variation
    const variance = 5;
    const securityScore = Math.round(Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * variance)));
    const completenessScore = Math.round(Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * variance)));
    const timelinessScore = Math.round(Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * variance)));
    const consistencyScore = Math.round(Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * variance)));
    
    const overallScore = Math.round((securityScore + completenessScore + timelinessScore + consistencyScore) / 4);
    
    return {
      qualityTier,
      overallScore,
      securityScore,
      completenessScore,
      timelinessScore,
      consistencyScore,
      hashes: [
        `0x${Math.random().toString(16).substr(2, 8)}`,
        `0x${Math.random().toString(16).substr(2, 8)}`,
        `0x${Math.random().toString(16).substr(2, 8)}`,
        `0x${Math.random().toString(16).substr(2, 8)}`,
        `0x${Math.random().toString(16).substr(2, 8)}`
      ],
      dataPoints: Math.floor(10000 + Math.random() * 90000),
      uptime: Number((95 + Math.random() * 5).toFixed(1)),
      lastUpdated: new Date().toISOString()
    };
  };

// Location helper
const getDisplayLocation = (listing: Listing): { 
  displayText: string; 
  lat: number | null; 
  lon: number | null; 
  isFake: boolean;
} => {
  const location = listing.deviceMetadata?.location;
  
  // Check if we have valid coordinates
  if (location && 
      typeof location === 'object' && 
      typeof location.latitude === 'number' && 
      typeof location.longitude === 'number' &&
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180) {
    return {
      displayText: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
      lat: location.latitude,
      lon: location.longitude,
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

export default function PurchaseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected, userType } = useWalletContext();
  const { listings, isLoading: listingsLoading, isError: listingsError } = useActiveListings();
  const { preparePurchase, finalizePurchase, isPreparing, isFinalizing, error: purchaseErrorHook } = useFakePurchaseListing();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [unitsRequested, setUnitsRequested] = useState<number>(1);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Fetch preview data for the specific listing
  const deviceId = listing?.deviceId || "";
  const { reading, isLoading: previewLoading, isError: previewError } = useLatestReading(deviceId);

  // Function to determine if device is offline (simulating sensor status)
  const isDeviceOffline = (listing: Listing | null): boolean => {
    if (!listing) return false;
    // For demo purposes, we'll assume devices without a dekCapsuleForBuyerCid are "offline"
    // This matches the logic from the purchases page where "Processing" status becomes "Offline"
    return !listing.dekCapsuleForBuyerCid;
  };

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
    
    // Check if device is offline before allowing purchase
    if (isDeviceOffline(listing)) {
      setShowOfflineWarning(true);
      return;
    }
    
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
      const { txSignature } = await finalizePurchase(listing.listingId, unitsRequested);
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
  const locationData = getDisplayLocation(listing);
  const dataType = listing.deviceMetadata?.dataTypes?.[0]?.type || "Generic";
  const frequency = listing.deviceMetadata?.dataTypes?.[0]?.frequency || "unit";
  const verified = !!listing.txSignature;
  
  // Helper function to get quality-based styling
  const getQualityStyle = (score: number, type: 'bg' | 'text' | 'border') => {
    if (score < 50) {
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-700',
        border: 'border-red-500/20'
      }[type];
    } else if (score < 75) {
      return {
        bg: 'bg-yellow-500/10', 
        text: 'text-yellow-700',
        border: 'border-yellow-500/20'
      }[type];
    } else {
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-700', 
        border: 'border-green-500/20'
      }[type];
    }
  };

  const getQualityIcon = (score: number) => {
    if (score < 50) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    } else if (score < 75) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    } else {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getQualityBadgeStyle = (score: number) => {
    if (score < 50) {
      return "bg-red-500/10 text-red-600 border-red-500/30";
    } else if (score < 75) {
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    } else {
      return "bg-green-500/10 text-green-600 border-green-500/30";
    }
  };

  // Generate consistent quality data for this device
  const qualityData = generateQualityChecks(listing.deviceId);

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
                <Tabs defaultValue="quality" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="quality">Quality Assurance</TabsTrigger>
                    <TabsTrigger value="details">Technical Details</TabsTrigger>
                  </TabsList>
                  <TabsContent value="quality" className="space-y-4 pt-4">
                    {/* Overall Quality Score Header */}
                    <div className={`p-4 rounded-lg border-2 ${getQualityStyle(qualityData.overallScore, 'bg')} ${getQualityStyle(qualityData.overallScore, 'border')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full ${getQualityStyle(qualityData.overallScore, 'bg')} flex items-center justify-center`}>
                            {getQualityIcon(qualityData.overallScore)}
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${getQualityStyle(qualityData.overallScore, 'text')}`}>
                              Overall Data Quality Score
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {qualityData.qualityTier === 'high' ? 'Premium Quality Data Source' : 
                               qualityData.qualityTier === 'medium' ? 'Good Quality Data Source' : 
                               qualityData.qualityTier === 'low' ? 'Budget Quality Data Source' :
                               'Poor Quality Data Source'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getQualityStyle(qualityData.overallScore, 'text')}`}>
                            {qualityData.overallScore}%
                          </div>
                          <Badge variant="outline" className={getQualityBadgeStyle(qualityData.overallScore)}>
                            {qualityData.qualityTier.toUpperCase()} TIER
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${getQualityStyle(qualityData.securityScore, 'bg')} ${getQualityStyle(qualityData.securityScore, 'border')}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getQualityStyle(qualityData.securityScore, 'bg')} flex items-center justify-center`}>
                            {getQualityIcon(qualityData.securityScore)}
                          </div>
                          <div>
                            <p className={`font-medium ${getQualityStyle(qualityData.securityScore, 'text')}`}>
                              Secure exchange between seller and buyer without decrypting on-chain
                            </p>
                            <p className="text-xs text-muted-foreground">{qualityData.hashes[0]} • RedaRahmani opened last month</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getQualityBadgeStyle(qualityData.securityScore)}>
                          {qualityData.securityScore}%
                        </Badge>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-lg border ${getQualityStyle(qualityData.completenessScore, 'bg')} ${getQualityStyle(qualityData.completenessScore, 'border')}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getQualityStyle(qualityData.completenessScore, 'bg')} flex items-center justify-center`}>
                            {getQualityIcon(qualityData.completenessScore)}
                          </div>
                          <div>
                            <p className={`font-medium ${getQualityStyle(qualityData.completenessScore, 'text')}`}>
                              Completeness – Check for Missing Fields or Packets
                            </p>
                            <p className="text-xs text-muted-foreground">{qualityData.hashes[1]} • RedaRahmani opened last month</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getQualityBadgeStyle(qualityData.completenessScore)}>
                          {qualityData.completenessScore}%
                        </Badge>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-lg border ${getQualityStyle(qualityData.timelinessScore, 'bg')} ${getQualityStyle(qualityData.timelinessScore, 'border')}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getQualityStyle(qualityData.timelinessScore, 'bg')} flex items-center justify-center`}>
                            {getQualityIcon(qualityData.timelinessScore)}
                          </div>
                          <div>
                            <p className={`font-medium ${getQualityStyle(qualityData.timelinessScore, 'text')}`}>
                              Timeliness – Check for Stale Data (Timestamp Delay)
                            </p>
                            <p className="text-xs text-muted-foreground">{qualityData.hashes[2]} • RedaRahmani opened last month</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getQualityBadgeStyle(qualityData.timelinessScore)}>
                          {qualityData.timelinessScore}%
                        </Badge>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-lg border ${getQualityStyle(qualityData.consistencyScore, 'bg')} ${getQualityStyle(qualityData.consistencyScore, 'border')}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getQualityStyle(qualityData.consistencyScore, 'bg')} flex items-center justify-center`}>
                            {getQualityIcon(qualityData.consistencyScore)}
                          </div>
                          <div>
                            <p className={`font-medium ${getQualityStyle(qualityData.consistencyScore, 'text')}`}>
                              Consistency – Detect Noisy Sensors (Rolling Variance)
                            </p>
                            <p className="text-xs text-muted-foreground">{qualityData.hashes[3]} • RedaRahmani opened last month</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getQualityBadgeStyle(qualityData.consistencyScore)}>
                          {qualityData.consistencyScore}%
                        </Badge>
                      </div>

                      {/* Data Quality Summary */}
                      <div className="p-4 bg-muted/50 rounded-lg border border-muted mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Data Quality Summary</span>
                          <span className="text-sm text-muted-foreground">
                            Last updated {new Date(qualityData.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Data Points:</span>
                            <span className="font-medium">{qualityData.dataPoints.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Uptime:</span>
                            <span className="font-medium">{qualityData.uptime.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quality Tier:</span>
                            <Badge variant="secondary" className="h-5 text-xs">
                              {qualityData.qualityTier.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reliability:</span>
                            <span className={`font-medium ${getQualityStyle(qualityData.overallScore, 'text')}`}>
                              {qualityData.overallScore >= 75 ? 'Excellent' : 
                               qualityData.overallScore >= 50 ? 'Good' : 'Poor'}
                            </span>
                          </div>
                        </div>
                        
                        {(qualityData.qualityTier === 'very-low' || qualityData.qualityTier === 'low') && (
                          <div className="mt-3 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <p className="text-xs text-amber-700">
                              ⚠️ {qualityData.qualityTier === 'very-low' ? 'This is a poor-quality data source with significant reliability issues.' : 'This is a budget-tier data source.'} Consider the quality metrics before purchasing.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
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

      {/* Offline Warning Dialog */}
      <Dialog open={showOfflineWarning} onOpenChange={setShowOfflineWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
                <WifiOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Sensor Offline</DialogTitle>
            <DialogDescription className="text-center">
              This sensor device is currently offline and cannot process new purchases.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-1">Purchase Cancelled</h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    The sensor is not actively collecting data. Please check back later when the device comes back online.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              You can browse other available sensors in the marketplace.
            </div>
          </div>
          
          <DialogFooter className="flex justify-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowOfflineWarning(false)}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowOfflineWarning(false);
                router.push('/buyer/marketplace');
              }}
              className="flex-1"
            >
              Browse Marketplace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}