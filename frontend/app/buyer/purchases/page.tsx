"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWalletContext } from "@/components/wallet-context-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Download, Clock, BarChart, ThermometerSun, Droplets, Wind, BarChart3 } from "lucide-react"

// Mock data for purchased listings
const mockPurchases = [
  {
    id: "purchase-1",
    listingId: "listing-1",
    title: "Urban Temperature Data",
    description: "High-precision temperature readings from downtown sensors",
    price: 0.5,
    unit: "hourly",
    purchaseDate: "2023-04-25T14:30:00Z",
    expiryDate: "2023-05-25T14:30:00Z",
    location: "New York City",
    deviceType: "temperature",
    seller: "0x1a2b...3c4d",
    rating: 4.8,
    dataCid: "Qm1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    apiKey: "sk_live_abcdefghijklmnopqrstuvwxyz123456",
  },
  {
    id: "purchase-2",
    listingId: "listing-2",
    title: "Air Quality Index Monitor",
    description: "Real-time air quality data including PM2.5, PM10, and VOCs",
    price: 0.8,
    unit: "daily",
    purchaseDate: "2023-04-20T10:15:00Z",
    expiryDate: "2023-05-20T10:15:00Z",
    location: "Los Angeles",
    deviceType: "air-quality",
    seller: "0x5e6f...7g8h",
    rating: 4.5,
    dataCid: "Qm2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u",
    apiKey: "sk_live_bcdefghijklmnopqrstuvwxyz1234567",
  },
]

export default function PurchasesPage() {
  const router = useRouter()
  const { connected, userType } = useWalletContext()
  const [purchases, setPurchases] = useState(mockPurchases)
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)

  useEffect(() => {
    if (!connected) {
      router.push("/")
      return
    }

    if (userType !== "buyer") {
      router.push("/")
      return
    }

    // Set the first purchase as selected by default
    if (purchases.length > 0 && !selectedPurchase) {
      setSelectedPurchase(purchases[0])
    }
  }, [connected, userType, router, purchases, selectedPurchase])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
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

  const handleRate = (purchaseId: string) => {
    // In a real app, this would open a rating dialog
    console.log("Rate purchase:", purchaseId)
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
            <h1 className="text-3xl font-bold">My Purchases</h1>
            <p className="text-muted-foreground">Access and manage your purchased data</p>
          </div>
        </div>

        {purchases.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Purchases List */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Your Data Subscriptions</CardTitle>
                  <CardDescription>
                    {purchases.length} active subscription{purchases.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedPurchase?.id === purchase.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedPurchase(purchase)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                            {getDeviceIcon(purchase.deviceType)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{purchase.title}</h3>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>Expires: {formatDate(purchase.expiryDate)}</span>
                            </div>
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

            {/* Selected Purchase Details */}
            {selectedPurchase && (
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{selectedPurchase.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <span>{selectedPurchase.location}</span>
                          <span className="mx-2">•</span>
                          <span>
                            {selectedPurchase.deviceType.charAt(0).toUpperCase() + selectedPurchase.deviceType.slice(1)}
                          </span>
                        </CardDescription>
                      </div>

                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Active
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Purchased</h4>
                        <p className="font-medium">{formatDate(selectedPurchase.purchaseDate)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Expires</h4>
                        <p className="font-medium">{formatDate(selectedPurchase.expiryDate)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Price</h4>
                        <p className="font-medium">
                          {selectedPurchase.price} SOL/{selectedPurchase.unit}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Seller</h4>
                        <p className="font-medium">{selectedPurchase.seller}</p>
                      </div>
                    </div>

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
                              <h4 className="text-sm font-medium mb-2">Latest Data</h4>
                              <pre className="text-xs font-mono">
                                {`[
  {
    "timestamp": "2023-04-27T12:00:00Z",
    "value": 22.5,
    "unit": "celsius",
    "location": "${selectedPurchase.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T12:15:00Z",
    "value": 22.7,
    "unit": "celsius",
    "location": "${selectedPurchase.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T12:30:00Z",
    "value": 23.1,
    "unit": "celsius",
    "location": "${selectedPurchase.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T12:45:00Z",
    "value": 23.4,
    "unit": "celsius",
    "location": "${selectedPurchase.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  },
  {
    "timestamp": "2023-04-27T13:00:00Z",
    "value": 23.8,
    "unit": "celsius",
    "location": "${selectedPurchase.location}",
    "device_id": "sensor-${Math.floor(Math.random() * 1000)}"
  }
]`}
                              </pre>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button className="flex-1 bg-primary hover:bg-primary/90">
                            <Download className="mr-2 h-4 w-4" />
                            Download Full Dataset
                          </Button>
                          <Button variant="outline" className="flex-1">
                            <BarChart className="mr-2 h-4 w-4" />
                            View Analytics
                          </Button>
                        </div>

                        <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                          <p className="text-sm text-muted-foreground">
                            <span className="text-secondary font-medium">Data CID:</span> {selectedPurchase.dataCid}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="api" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="api-key">Your API Key</Label>
                          <div className="flex">
                            <Input
                              id="api-key"
                              value={selectedPurchase.apiKey}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button variant="ghost" size="icon" className="ml-2">
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
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </Button>
                          </div>
                        </div>

                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="text-sm font-medium mb-2">API Endpoint</h4>
                          <code className="text-xs font-mono block p-2 bg-black/20 rounded">
                            https://api.chainsensors.io/v1/data/{selectedPurchase.listingId}
                          </code>

                          <h4 className="text-sm font-medium mt-4 mb-2">Example Request</h4>
                          <pre className="text-xs font-mono p-2 bg-black/20 rounded overflow-x-auto">
                            {`curl -X GET "https://api.chainsensors.io/v1/data/${selectedPurchase.listingId}" \\
  -H "Authorization: Bearer ${selectedPurchase.apiKey}" \\
  -H "Content-Type: application/json"`}
                          </pre>
                        </div>

                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                          <p className="text-sm text-muted-foreground">
                            <span className="text-primary font-medium">Note:</span> Keep your API key secure. You can
                            regenerate it if needed by contacting support.
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="transaction" className="space-y-4 pt-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Transaction ID</h4>
                              <p className="font-mono text-xs break-all">
                                4zGKLBjD9Kj7ymF5vu2jLQ9GHFVHmqUP8HzR1WxEYpT7
                              </p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Purchase Date</h4>
                              <p className="font-medium">{formatDate(selectedPurchase.purchaseDate)}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Amount</h4>
                              <p className="font-medium">{selectedPurchase.price} SOL</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                              <p className="text-green-500 font-medium">Confirmed</p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border">
                            <Button variant="outline" size="sm" className="text-xs">
                              View on Solana Explorer
                            </Button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <Button variant="outline" size="sm" onClick={() => handleRate(selectedPurchase.id)}>
                            Rate This Data
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            Report Issue
                          </Button>
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
      </div>
    </main>
  )
}
