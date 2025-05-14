
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { Navbar } from "@/components/navbar";
import { useRegisterDevice } from "@/hooks/useRegisterDevice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cpu,
  MapPin,
  Activity,
  RotateCw,
} from "lucide-react";
import { EnrollMetadata } from "../index";

const deviceTypes = [
  { value: "temperature", label: "Temperature Sensor", units: "°C" },
  { value: "humidity", label: "Humidity Sensor", units: "%" },
  { value: "air-quality", label: "Air Quality Monitor", units: "µg/m³" },
  { value: "synthetic_obd_data", label: "Synthetic OBD Data", units: "" },
  // …add more as needed
];

const dataFrequencies = [
  { value: "0.016Hz", label: "Every minute" },
  { value: "0.2Hz", label: "Every 5 minutes" },
  { value: "0.066Hz", label: "Every 15 minutes" },
  { value: "0.016Hz", label: "Every 60 minutes" },
];

export default function RegisterDeviceClient() {
  const router = useRouter();
  const registerDevice = useRegisterDevice();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    deviceId: string;
    certificatePem: string;
    brokerUrl: string;
    txSignature: string;
  } | null>(null);

  // Form state
  const [csrPem, setCsrPem] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState(deviceTypes[0].value);
  const [deviceLocation, setDeviceLocation] = useState("");
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [dataFrequency, setDataFrequency] = useState(dataFrequencies[0].value);
  const [dataAccuracy, setDataAccuracy] = useState<number[]>([90]);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build metadata for backend
      const metadata: EnrollMetadata = {
        deviceName,
        model: deviceType,
        location: { latitude, longitude },
        dataTypes: [
          {
            type: deviceType,
            units: deviceTypes.find((t) => t.value === deviceType)?.units || "",
            frequency: dataFrequency,
          },
        ],
        pricePerUnit: 1, // TODO: add real price input
        totalDataUnits: dataAccuracy[0] * 10, // e.g. accuracy slider → units
      };

      const res = await registerDevice(csrPem, metadata);
      setResult(res);
      setStep(5); // success page
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (step === 5 && result) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <Check className="mr-2" /> Device Registered
              </CardTitle>
              <CardDescription>
                On-chain tx: <code>{result.txSignature}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Certificate PEM</h4>
                <pre className="p-4 bg-gray-400 text-green-200 rounded overflow-auto text-sm font-mono whitespace-pre-wrap">
                  <code>{result.certificatePem}</code>
                </pre>
              </div>
              <div>
                <h4 className="font-medium">MQTT Broker URL</h4>
                <p>{result.brokerUrl}</p>
              </div>
              <div>
                <h4 className="font-medium">Device ID</h4>
                <p>{result.deviceId}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push("/seller/dashboard")}>
                Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Header & Progress */}
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
            <h1 className="text-3xl font-bold">Register IoT Device</h1>
            <p className="text-muted-foreground">Step {step} of 4</p>
          </div>
        </div>

        {/* Steps */}
        <div className="max-w-3xl mx-auto space-y-8">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="mr-2" /> Basic Info
                </CardTitle>
                <CardDescription>Paste your CSR and device details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>CSR (PEM)</Label>
                  <textarea
                    rows={6}
                    className="w-full p-2 border rounded"
                    value={csrPem}
                    onChange={(e) => setCsrPem(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
                    required
                  />
                </div>
                <div>
                  <Label>Device Name</Label>
                  <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Air Sensor #1"
                  />
                </div>
                <div>
                  <Label>Device Type</Label>
                  <Select value={deviceType} onValueChange={setDeviceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => router.push("/seller/dashboard")}
                >
                  Cancel
                </Button>
                <Button onClick={next} disabled={!csrPem || !deviceName}>
                  Next
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="mr-2" /> Location
                </CardTitle>
                <CardDescription>Where is your device?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Location Description</Label>
                  <Input
                    value={deviceLocation}
                    onChange={(e) => setDeviceLocation(e.target.value)}
                    placeholder="Rooftop"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={back}>
                  Back
                </Button>
                <Button onClick={next} disabled={!deviceLocation}>
                  Next
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2" /> Data Specs
                </CardTitle>
                <CardDescription>Configure frequency & accuracy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Frequency</Label>
                  <Select value={dataFrequency} onValueChange={setDataFrequency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataFrequencies.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Accuracy (%)</Label>
                  <Slider
                    min={50}
                    max={100}
                    value={dataAccuracy}
                    onValueChange={setDataAccuracy}
                  />
                  <div className="text-sm mt-1">{dataAccuracy[0]}%</div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={back}>
                  Back
                </Button>
                <Button onClick={next}>Next</Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Check className="mr-2" /> Confirm
                </CardTitle>
                <CardDescription>Review and register</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h4 className="font-medium">Name:</h4>
                <p>{deviceName}</p>
                <h4 className="font-medium">Type:</h4>
                <p>{deviceTypes.find((t) => t.value === deviceType)?.label}</p>
                <h4 className="font-medium">Location:</h4>
                <p>
                  {deviceLocation} ({latitude}, {longitude})
                </p>
                <h4 className="font-medium">Frequency:</h4>
                <p>{dataFrequency}</p>
                <h4 className="font-medium">Accuracy:</h4>
                <p>{dataAccuracy[0]}%</p>
                {error && <p className="text-red-600">{error}</p>}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={back}>
                  Back
                </Button>
                <Button onClick={handleRegister} disabled={loading}>
                  {loading ? (
                    <>
                      <RotateCw className="animate-spin mr-2" />
                      Registering…
                    </>
                  ) : (
                    "Register Device"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}