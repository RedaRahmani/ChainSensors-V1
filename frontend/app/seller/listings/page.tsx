"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletContext } from "@/components/wallet-context-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, ArrowRight, Check, Upload, Tag, FileText, RotateCw, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock devices for selection
const mockDevices = [
  { id: "dev-1", name: "Temperature Sensor #1", type: "temperature" },
  { id: "dev-2", name: "Humidity Monitor", type: "humidity" },
  { id: "dev-3", name: "Air Quality Sensor", type: "air-quality" },
  { id: "dev-4", name: "Soil Moisture Probe", type: "soil-moisture" },
]

export default function CreateListing() {
  const router = useRouter()
  const { connected, userType } = useWalletContext()
  const [currentStep, setCurrentStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showFeeDialog, setShowFeeDialog] = useState(false)

  // Form state
  const [selectedDevice, setSelectedDevice] = useState("")
  const [listingTitle, setListingTitle] = useState("")
  const [listingDescription, setListingDescription] = useState("")
  const [price, setPrice] = useState("")
  const [pricingUnit, setPricingUnit] = useState("hourly")
  const [dataCid, setDataCid] = useState("")
  const [isUploaded, setIsUploaded] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [previewEnabled, setPreviewEnabled] = useState(true)

  const handleNext = () => {
    setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleUpload = () => {
    setIsUploading(true)

    // Simulate upload to Walrus
    setTimeout(() => {
      setIsUploading(false)
      setIsUploaded(true)
      setDataCid("Qm1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t")
    }, 2000)
  }

  const handleCreateListing = () => {
    setShowFeeDialog(true)
  }

  const confirmCreateListing = () => {
    setShowFeeDialog(false)
    setIsCreating(true)

    // Simulate blockchain transaction
    setTimeout(() => {
      setIsCreating(false)
      setIsSuccess(true)

      // Redirect after success
      setTimeout(() => {
        router.push("/seller/dashboard")
      }, 2000)
    }, 2000)
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push("/seller/dashboard")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div>
            <h1 className="text-3xl font-bold">Create Data Listing</h1>
            <p className="text-muted-foreground">List your IoT data for sale on the marketplace</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex justify-between">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className="flex flex-col items-center"
                  onClick={() => {
                    if (step < currentStep) {
                      setCurrentStep(step)
                    }
                  }}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      step < currentStep
                        ? "bg-primary text-primary-foreground"
                        : step === currentStep
                          ? "bg-secondary text-secondary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground"
                    } ${step < currentStep ? "cursor-pointer" : ""}`}
                  >
                    {step < currentStep ? <Check className="h-5 w-5" /> : <span>{step}</span>}
                  </div>
                  <div
                    className={`text-xs ${step === currentStep ? "text-secondary font-medium" : "text-muted-foreground"}`}
                  >
                    {step === 1 && "Data Upload"}
                    {step === 2 && "Listing Details"}
                    {step === 3 && "Pricing & Preview"}
                  </div>
                </div>
              ))}
            </div>
            <div className="relative mt-2">
              <div className="absolute top-0 left-0 h-1 bg-muted w-full rounded-full"></div>
              <div
                className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step 1: Data Upload */}
          {currentStep === 1 && (
            <Card className="border-primary/20 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5 text-primary" />
                  Data Upload
                </CardTitle>
                <CardDescription>Select a device and upload sample data to Walrus storage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="device-select">Select Device</Label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger id="device-select">
                      <SelectValue placeholder="Choose a registered device" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>

                    <h3 className="text-lg font-medium">Upload Sample Data</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                      Drag and drop your data file or click to browse
                    </p>

                    <Button
                      onClick={handleUpload}
                      disabled={!selectedDevice || isUploading || isUploaded}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isUploading ? (
                        <>
                          <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : isUploaded ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Uploaded Successfully
                        </>
                      ) : (
                        "Select File"
                      )}
                    </Button>

                    {isUploaded && (
                      <div className="mt-4 text-sm">
                        <p className="text-primary font-medium">Data CID:</p>
                        <code className="bg-primary/10 p-1 rounded text-xs">{dataCid}</code>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-secondary font-medium">Note:</span> Your data will be stored on Walrus
                    decentralized storage. Only a sample is required for the listing preview.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
                  Cancel
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!isUploaded}
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Step 2: Listing Details */}
          {currentStep === 2 && (
            <Card className="border-secondary/20 shadow-lg shadow-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-secondary" />
                  Listing Details
                </CardTitle>
                <CardDescription>Provide information about your data listing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="listing-title">Listing Title</Label>
                  <Input
                    id="listing-title"
                    placeholder="Enter a descriptive title"
                    value={listingTitle}
                    onChange={(e) => setListingTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="listing-description">Description</Label>
                  <textarea
                    id="listing-description"
                    className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background"
                    placeholder="Describe your data, its potential uses, and any unique features"
                    value={listingDescription}
                    onChange={(e) => setListingDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="private-toggle">Private Listing</Label>
                    <Switch id="private-toggle" checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Private listings are only visible to specific buyers you invite
                  </p>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-medium">Tip:</span> Detailed, accurate descriptions help buyers
                    find your data and understand its value.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!listingTitle || !listingDescription}
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Step 3: Pricing & Preview */}
          {currentStep === 3 && (
            <Card className="border-primary/20 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="mr-2 h-5 w-5 text-primary" />
                  Pricing & Preview
                </CardTitle>
                <CardDescription>Set your price and preview how your listing will appear</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pricing" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    <TabsTrigger value="preview">Listing Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="pricing" className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price (SOL)</Label>
                        <Input
                          id="price"
                          type="number"
                          placeholder="0.00"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pricing-unit">Pricing Unit</Label>
                        <Select value={pricingUnit} onValueChange={setPricingUnit}>
                          <SelectTrigger id="pricing-unit">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Per Hour</SelectItem>
                            <SelectItem value="daily">Per Day</SelectItem>
                            <SelectItem value="weekly">Per Week</SelectItem>
                            <SelectItem value="monthly">Per Month</SelectItem>
                            <SelectItem value="one-time">One-time Purchase</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="preview-toggle" className="flex items-center">
                          Enable Free Preview
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground ml-2" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="w-[200px] text-xs">
                                  Allow potential buyers to see a limited sample of your data before purchasing
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Switch id="preview-toggle" checked={previewEnabled} onCheckedChange={setPreviewEnabled} />
                      </div>
                    </div>

                    <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Platform Fee:</p>
                          <p className="text-xs text-muted-foreground">5% of sales</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-secondary/50 text-secondary hover:text-secondary hover:bg-secondary/10"
                        >
                          Fee Details
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="pt-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-card p-4 border-b">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold">{listingTitle || "Your Listing Title"}</h3>
                            <p className="text-sm text-muted-foreground">
                              Device: {mockDevices.find((d) => d.id === selectedDevice)?.name || "Selected Device"}
                            </p>
                          </div>
                          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                            {price ? `${price} SOL ${pricingUnit}` : "Price"}
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm">
                            {listingDescription ||
                              "Your detailed description will appear here. Make sure to include information about what the data contains, its potential applications, and any unique features."}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          {isPrivate && (
                            <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs">
                              Private
                            </span>
                          )}
                          {previewEnabled && (
                            <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs">
                              Preview Available
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-dark-100 to-dark-200">
                        <div className="rounded-lg overflow-hidden border border-primary/20 h-[150px] relative">
                          <div className="absolute inset-0 grid-bg opacity-70"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Data preview will be shown here</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex justify-between items-center bg-card">
                        <div>
                          <p className="text-sm font-medium">
                            Data updated: <span className="text-muted-foreground">Recently</span>
                          </p>
                        </div>
                        <Button className="bg-secondary hover:bg-secondary/90">Buy Now</Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateListing}
                  disabled={!price || isCreating || isSuccess}
                  className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${isSuccess ? "bg-green-500" : ""}`}
                >
                  {isCreating ? (
                    <>
                      <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : isSuccess ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Created Successfully
                    </>
                  ) : (
                    "Create Listing"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Fee Confirmation Dialog */}
          <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Listing Creation</DialogTitle>
                <DialogDescription>Review the platform fees before creating your listing</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Listing Price:</span>
                    <span className="font-medium">
                      {price} SOL {pricingUnit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Platform Fee (5%):</span>
                    <span className="font-medium">{(Number.parseFloat(price) * 0.05).toFixed(3)} SOL</span>
                  </div>
                  <div className="border-t border-border mt-2 pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium">You Receive:</span>
                    <span className="font-bold">{(Number.parseFloat(price) * 0.95).toFixed(3)} SOL</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Creating this listing will require a small transaction fee on the Solana blockchain.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFeeDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmCreateListing} className="bg-primary hover:bg-primary/90">
                  Confirm & Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </main>
  )
}
