"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useWalletContext } from "@/components/wallet-context-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock data for listings (same as in marketplace)
const mockListings = [
  {
    id: "listing-1",
    title: "Urban Temperature Data",
    description: "High-precision temperature readings from downtown sensors",
    price: 0.5,
    unit: "hourly",
    location: "New York City",
    deviceType: "temperature",
    seller: "0x1a2b...3c4d",
    rating: 4.8,
    verified: true,
    preview: true,
  },
  {
    id: "listing-2",
    title: "Air Quality Index Monitor",
    description: "Real-time air quality data including PM2.5, PM10, and VOCs",
    price: 0.8,
    unit: "daily",
    location: "Los Angeles",
    deviceType: "air-quality",
    seller: "0x5e6f...7g8h",
    rating: 4.5,
    verified: true,
    preview: true,
  },
  {
    id: "listing-3",
    title: "Soil Moisture Analytics",
    description: "Agricultural soil moisture data with 15-minute intervals",
    price: 1.2,
    unit: "daily",
    location: "Iowa",
    deviceType: "soil-moisture",
    seller: "0x9i0j...1k2l",
    rating: 4.9,
    verified: true,
    preview: false,
  },
  {
    id: "listing-4",
    title: "Wind Speed & Direction",
    description: "Coastal wind measurements with directional analysis",
    price: 0.3,
    unit: "hourly",
    location: "Miami",
    deviceType: "wind",
    seller: "0x3m4n...5o6p",
    rating: 4.2,
    verified: false,
    preview: true,
  },
  {
    id: "listing-5",
    title: "Humidity Patterns",
    description: "Indoor and outdoor humidity comparisons",
    price: 0.6,
    unit: "daily",
    location: "Seattle",
    deviceType: "humidity",
    seller: "0x7q8r...9s0t",
    rating: 4.7,
    verified: true,
    preview: true,
  },
  {
    id: "listing-6",
    title: "Traffic Flow Sensors",
    description: "Vehicle count and speed data from major intersections",
    price: 2.0,
    unit: "daily",
    location: "Chicago",
    deviceType: "traffic",
    seller: "0x1u2v...3w4x",
    rating: 4.6,
    verified: true,
    preview: false,
  },
]

export default function PurchasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { connected, userType } = useWalletContext()
  const [listing, setListing] = useState<any>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    if (!connected) {
      router.push("/")
      return
    }

    if (userType !== "buyer") {
      router.push("/")
      return
    }

    const listingId = searchParams.get("id")
    if (!listingId) {
      router.push("/buyer/marketplace")
      return
    }

    const foundListing = mockListings.find((item) => item.id === listingId)
    if (!foundListing) {
      router.push("/buyer/marketplace")
      return
    }

    setListing(foundListing)
  }, [connected, userType, router, searchParams])

  const handlePurchase = () => {
    setShowConfirmDialog(true)
  }

  const confirmPurchase = () => {
    setShowConfirmDialog(false)
    setIsPurchasing(true)

    // Simulate blockchain transaction
    setTimeout(() => {
      setIsPurchasing(false)
      setIsSuccess(true)

      // Redirect after success
      setTimeout(() => {
        router.push("/buyer/purchases")
      }, 2000)
    }, 2000)
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "temperature":
        return <ThermometerSun className="h-5 w-5" />
      case "humidity":
        return <Droplets className="h-5 w-5" />
      case "air-quality":
        return <Wind className="h-5 w-5" />
      case "soil-moisture":
        return <Droplets className="h-5 w-5" />
      case "wind":
        return <Wind className="h-5 w-5" />
      default:
        return <BarChart3 className="h-5 w-5" />
    }
  }

  if (!listing) {
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
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/buyer/marketplace")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>

          <div>
            <h1 className="text-3xl font-bold">Purchase Data</h1>
            <p className="text-muted-foreground">Review and buy IoT data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Listing Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{listing.title}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      {listing.location}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {listing.verified && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
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
                    {getDeviceIcon(listing.deviceType)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {listing.deviceType.charAt(0).toUpperCase() + listing.deviceType.slice(1)} Sensor
                    </p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span>{listing.rating} rating</span>
                      <span className="mx-2">•</span>
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Updated recently</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground">{listing.description}</p>
                </div>

                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">Data Preview</TabsTrigger>
                    <TabsTrigger value="details">Technical Details</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="space-y-4 pt-4">
                    {listing.preview ? (
                      <div className="rounded-lg overflow-hidden border border-primary/20 h-[250px] relative">
                        <div className="absolute inset-0 grid-bg opacity-70"></div>
                        <div className="absolute inset-0 p-4">
                          <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20 h-full overflow-auto">
                            <h4 className="text-sm font-medium mb-2">Sample Data (Limited Preview)</h4>
                            <pre className="text-xs font-mono">
                              {`[
  {
    "timestamp": "2023-04-27T12:00:00Z",
    "value": 22.5,
    "unit": "celsius",
    "location": "${listing.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T12:15:00Z",
    "value": 22.7,
    "unit": "celsius",
    "location": "${listing.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T12:30:00Z",
    "value": 23.1,
    "unit": "celsius",
    "location": "${listing.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  }
]`}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-muted h-[250px] flex items-center justify-center bg-muted/30">
                        <div className="text-center p-4">
                          <p className="text-muted-foreground mb-2">No preview available for this listing</p>
                          <p className="text-sm text-muted-foreground">Purchase to access the full dataset</p>
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
                          {listing.unit === "hourly"
                            ? "Every hour"
                            : listing.unit === "daily"
                              ? "Every day"
                              : listing.unit === "weekly"
                                ? "Every week"
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
                      <p className="font-medium">Seller ID: {listing.seller}</p>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                        <span>{listing.rating} average rating</span>
                        <span className="mx-2">•</span>
                        <span>Active since 2023</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Purchase Card */}
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
                    <span className="font-medium">{listing.title}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Price:</span>
                    <div>
                      <span className="font-bold">{listing.price} SOL</span>
                      <span className="text-xs text-muted-foreground ml-1">/{listing.unit}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Network Fee:</span>
                    <span className="font-medium">0.000005 SOL</span>
                  </div>
                  <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium">Total:</span>
                    <span className="font-bold">{(listing.price + 0.000005).toFixed(6)} SOL</span>
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
                      {listing.unit === "hourly"
                        ? "Hourly"
                        : listing.unit === "daily"
                          ? "Daily"
                          : listing.unit === "weekly"
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
              </CardContent>

              <CardFooter>
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing || isSuccess}
                  className={`w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${isSuccess ? "bg-green-500" : ""}`}
                >
                  {isPurchasing ? (
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

      {/* Confirmation Dialog */}
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
                <span className="font-medium">{listing.title}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Price:</span>
                <div>
                  <span className="font-bold">{listing.price} SOL</span>
                  <span className="text-xs text-muted-foreground ml-1">/{listing.unit}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Network Fee:</span>
                <span className="font-medium">0.000005 SOL</span>
              </div>
              <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
                <span className="text-sm font-medium">Total:</span>
                <span className="font-bold">{(listing.price + 0.000005).toFixed(6)} SOL</span>
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
            <Button onClick={confirmPurchase} className="bg-primary hover:bg-primary/90">
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
