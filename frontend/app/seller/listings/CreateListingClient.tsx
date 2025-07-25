
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RotateCw, Check } from "lucide-react";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useCreateListing, CreateListingParams } from "@/hooks/useCreateListing";

export default function CreateListingClient() {
  const router = useRouter();
  const { connected, publicKey } = useWalletContext();
  const sellerPubkey = publicKey || null;
  const { devices, isLoading, isError, refetch } = useMyDevices(sellerPubkey);
  const createListing = useCreateListing();

  // Form state
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [pricePerUnit, setPricePerUnit] = useState<string>("");
  const [totalDataUnits, setTotalDataUnits] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [dataCid, setDataCid] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle device selection and prefill dataCid
  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(deviceId);
    const device = devices?.find((d) => d.deviceId === deviceId);
    if (device?.latestDataCid) {
      setDataCid(device.latestDataCid);
    } else {
      setDataCid("");
    }
  };

  // Validate and submit listing
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

    const params: CreateListingParams = {
      deviceId: selectedDevice,
      dataCid: dataCid || "default-cid-from-backend", // Fallback if empty
      pricePerUnit: price,
      totalDataUnits: units,
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
    };

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const txSignature = await createListing(params);
      console.log(`Listing created successfully with txSignature: ${txSignature}`);
      setIsSuccess(true);
      setTimeout(() => router.push("/seller/dashboard"), 2000); // Redirect after success
    } catch (error: any) {
      console.error("Error creating listing:", error);
      setErrorMessage(error.message || "Failed to create listing. Please try again.");
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
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">Loading devices...</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-red-500">Error fetching devices. Please try again.</p>
          <Button variant="outline" onClick={refetch} className="mt-4">
            Retry
          </Button>
        </div>
      </main>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">
            No devices found. Register a device to create a listing.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/seller/dashboard")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Data Listing</h1>
            <p className="text-muted-foreground">
              List your IoT data for sale on the marketplace
            </p>
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
                                      {devices.map((device, i) => (
                    <SelectItem
                      key={`${device.deviceId}-${i}`}
                      value={device.deviceId}
                    >
                      {device.metadata?.deviceName || "Unnamed Device"} (
                      {device.deviceId})
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDevice && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Listing Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price-per-unit">Price per Unit (usdc)</Label>
                      <Input
                        id="price-per-unit"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total-data-units">Total Data Units</Label>
                      <Input
                        id="total-data-units"
                        type="number"
                        min="1"
                        placeholder="1000"
                        value={totalDataUnits}
                        onChange={(e) => setTotalDataUnits(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires-at">Expires At (optional)</Label>
                    <Input
                      id="expires-at"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  {dataCid && (
                    <div className="space-y-2">
                      <Label htmlFor="data-cid">Data CID (prefilled)</Label>
                      <Input id="data-cid" value={dataCid} disabled />
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <p className="text-red-500 text-sm">{errorMessage}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
                Cancel
              </Button>
              {selectedDevice && (
                <Button
                  onClick={handleCreateListing}
                  disabled={isCreating || isSuccess}
                  className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${
                    isSuccess ? "bg-green-500" : ""
                  }`}
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
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}