// "use client"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import { useWalletContext } from "@/components/wallet-context-provider"
// import { Navbar } from "@/components/navbar"
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Slider } from "@/components/ui/slider"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { ArrowLeft, ArrowRight, Check, Cpu, MapPin, Activity, RotateCw } from "lucide-react"

// const deviceTypes = [
//   { value: "temperature", label: "Temperature Sensor" },
//   { value: "humidity", label: "Humidity Sensor" },
//   { value: "air-quality", label: "Air Quality Monitor" },
//   { value: "soil-moisture", label: "Soil Moisture Sensor" },
//   { value: "light", label: "Light Sensor" },
//   { value: "motion", label: "Motion Detector" },
//   { value: "pressure", label: "Pressure Sensor" },
//   { value: "water-quality", label: "Water Quality Sensor" },
// ]

// const dataFrequencies = [
//   { value: "1", label: "Every minute" },
//   { value: "5", label: "Every 5 minutes" },
//   { value: "15", label: "Every 15 minutes" },
//   { value: "30", label: "Every 30 minutes" },
//   { value: "60", label: "Hourly" },
//   { value: "360", label: "Every 6 hours" },
//   { value: "720", label: "Every 12 hours" },
//   { value: "1440", label: "Daily" },
// ]

// export default function RegisterDevice() {
//   const router = useRouter()
//   const { connected, userType } = useWalletContext()
//   const [currentStep, setCurrentStep] = useState(1)
//   const [isRegistering, setIsRegistering] = useState(false)
//   const [isSuccess, setIsSuccess] = useState(false)

//   // Form state
//   const [deviceName, setDeviceName] = useState("")
//   const [deviceType, setDeviceType] = useState("")
//   const [deviceLocation, setDeviceLocation] = useState("")
//   const [dataFrequency, setDataFrequency] = useState("")
//   const [dataAccuracy, setDataAccuracy] = useState([85])
//   const [deviceDescription, setDeviceDescription] = useState("")

//   const handleNext = () => {
//     setCurrentStep(currentStep + 1)
//   }

//   const handleBack = () => {
//     setCurrentStep(currentStep - 1)
//   }

//   const handleRegister = async () => {
//     setIsRegistering(true)

//     // Simulate blockchain transaction
//     setTimeout(() => {
//       setIsRegistering(false)
//       setIsSuccess(true)

//       // Redirect after success
//       setTimeout(() => {
//         router.push("/seller/dashboard")
//       }, 2000)
//     }, 2000)
//   }

//   return (
//     <main className="min-h-screen bg-background">
//       <Navbar />

//       <div className="container mx-auto px-4 pt-24 pb-16">
//         <div className="flex items-center mb-8">
//           <Button variant="ghost" size="sm" onClick={() => router.push("/seller/dashboard")} className="mr-4">
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back to Dashboard
//           </Button>

//           <div>
//             <h1 className="text-3xl font-bold">Register IoT Device</h1>
//             <p className="text-muted-foreground">Connect your device to the Chainsensors marketplace</p>
//           </div>
//         </div>

//         <div className="max-w-3xl mx-auto">
//           {/* Progress Indicator */}
//           <div className="mb-8">
//             <div className="flex justify-between">
//               {[1, 2, 3, 4].map((step) => (
//                 <div
//                   key={step}
//                   className="flex flex-col items-center"
//                   onClick={() => {
//                     if (step < currentStep) {
//                       setCurrentStep(step)
//                     }
//                   }}
//                 >
//                   <div
//                     className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
//                       step < currentStep
//                         ? "bg-primary text-primary-foreground"
//                         : step === currentStep
//                           ? "bg-secondary text-secondary-foreground animate-pulse"
//                           : "bg-muted text-muted-foreground"
//                     } ${step < currentStep ? "cursor-pointer" : ""}`}
//                   >
//                     {step < currentStep ? <Check className="h-5 w-5" /> : <span>{step}</span>}
//                   </div>
//                   <div
//                     className={`text-xs ${step === currentStep ? "text-secondary font-medium" : "text-muted-foreground"}`}
//                   >
//                     {step === 1 && "Basic Info"}
//                     {step === 2 && "Location"}
//                     {step === 3 && "Data Specs"}
//                     {step === 4 && "Confirm"}
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <div className="relative mt-2">
//               <div className="absolute top-0 left-0 h-1 bg-muted w-full rounded-full"></div>
//               <div
//                 className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
//                 style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
//               ></div>
//             </div>
//           </div>

//           {/* Step 1: Basic Info */}
//           {currentStep === 1 && (
//             <Card className="border-primary/20 shadow-lg shadow-primary/5">
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Cpu className="mr-2 h-5 w-5 text-primary" />
//                   Device Information
//                 </CardTitle>
//                 <CardDescription>Enter the basic details about your IoT device</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-6">
//                 <div className="space-y-2">
//                   <Label htmlFor="device-name">Device Name</Label>
//                   <Input
//                     id="device-name"
//                     placeholder="Enter a name for your device"
//                     value={deviceName}
//                     onChange={(e) => setDeviceName(e.target.value)}
//                   />
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="device-type">Device Type</Label>
//                   <Select value={deviceType} onValueChange={setDeviceType}>
//                     <SelectTrigger id="device-type">
//                       <SelectValue placeholder="Select device type" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {deviceTypes.map((type) => (
//                         <SelectItem key={type.value} value={type.value}>
//                           {type.label}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="device-description">Device Description</Label>
//                   <textarea
//                     id="device-description"
//                     className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background"
//                     placeholder="Describe your device and the data it collects"
//                     value={deviceDescription}
//                     onChange={(e) => setDeviceDescription(e.target.value)}
//                   />
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={() => router.push("/seller/dashboard")}>
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={handleNext}
//                   disabled={!deviceName || !deviceType}
//                   className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
//                 >
//                   Next Step
//                   <ArrowRight className="ml-2 h-4 w-4" />
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* Step 2: Location */}
//           {currentStep === 2 && (
//             <Card className="border-secondary/20 shadow-lg shadow-secondary/5">
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <MapPin className="mr-2 h-5 w-5 text-secondary" />
//                   Device Location
//                 </CardTitle>
//                 <CardDescription>Specify where your IoT device is located</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-6">
//                 <div className="space-y-2">
//                   <Label htmlFor="device-location">Location Description</Label>
//                   <Input
//                     id="device-location"
//                     placeholder="e.g., Rooftop, Garden, Indoor, etc."
//                     value={deviceLocation}
//                     onChange={(e) => setDeviceLocation(e.target.value)}
//                   />
//                 </div>

//                 <div className="rounded-lg overflow-hidden border border-input h-[200px] relative">
//                   <div className="absolute inset-0 grid-bg opacity-70"></div>
//                   <div className="absolute inset-0 flex items-center justify-center">
//                     <div className="text-center">
//                       <MapPin className="h-8 w-8 text-secondary mx-auto mb-2" />
//                       <p className="text-sm text-muted-foreground">Interactive map will be available here</p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
//                   <p className="text-sm text-muted-foreground">
//                     <span className="text-secondary font-medium">Note:</span> Precise location data helps buyers
//                     understand the context of your sensor data. However, you can provide a general area if you prefer
//                     not to share exact coordinates.
//                   </p>
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={handleBack}>
//                   <ArrowLeft className="mr-2 h-4 w-4" />
//                   Back
//                 </Button>
//                 <Button
//                   onClick={handleNext}
//                   disabled={!deviceLocation}
//                   className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
//                 >
//                   Next Step
//                   <ArrowRight className="ml-2 h-4 w-4" />
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* Step 3: Data Specs */}
//           {currentStep === 3 && (
//             <Card className="border-primary/20 shadow-lg shadow-primary/5">
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Activity className="mr-2 h-5 w-5 text-primary" />
//                   Data Specifications
//                 </CardTitle>
//                 <CardDescription>Define the characteristics of the data your device collects</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-6">
//                 <div className="space-y-2">
//                   <Label htmlFor="data-frequency">Data Collection Frequency</Label>
//                   <Select value={dataFrequency} onValueChange={setDataFrequency}>
//                     <SelectTrigger id="data-frequency">
//                       <SelectValue placeholder="Select frequency" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {dataFrequencies.map((freq) => (
//                         <SelectItem key={freq.value} value={freq.value}>
//                           {freq.label}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <Label htmlFor="data-accuracy">Data Accuracy</Label>
//                     <span className="text-sm text-muted-foreground">{dataAccuracy[0]}%</span>
//                   </div>
//                   <Slider
//                     id="data-accuracy"
//                     min={50}
//                     max={100}
//                     step={1}
//                     value={dataAccuracy}
//                     onValueChange={setDataAccuracy}
//                     className="py-4"
//                   />
//                   <div className="flex justify-between text-xs text-muted-foreground">
//                     <span>Low</span>
//                     <span>Medium</span>
//                     <span>High</span>
//                   </div>
//                 </div>

//                 <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
//                   <p className="text-sm text-muted-foreground">
//                     <span className="text-primary font-medium">Tip:</span> Higher accuracy and frequency data typically
//                     commands higher prices in the marketplace, but ensure your claims match your device's actual
//                     capabilities.
//                   </p>
//                 </div>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={handleBack}>
//                   <ArrowLeft className="mr-2 h-4 w-4" />
//                   Back
//                 </Button>
//                 <Button
//                   onClick={handleNext}
//                   disabled={!dataFrequency}
//                   className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
//                 >
//                   Next Step
//                   <ArrowRight className="ml-2 h-4 w-4" />
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}

//           {/* Step 4: Confirm */}
//           {currentStep === 4 && (
//             <Card className="border-secondary/20 shadow-lg shadow-secondary/5">
//               <CardHeader>
//                 <CardTitle className="flex items-center">
//                   <Check className="mr-2 h-5 w-5 text-secondary" />
//                   Confirm Registration
//                 </CardTitle>
//                 <CardDescription>Review your device details before registering on the blockchain</CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <Tabs defaultValue="summary" className="w-full">
//                   <TabsList className="grid w-full grid-cols-2">
//                     <TabsTrigger value="summary">Summary</TabsTrigger>
//                     <TabsTrigger value="technical">Technical Details</TabsTrigger>
//                   </TabsList>
//                   <TabsContent value="summary" className="space-y-4 pt-4">
//                     <div className="grid grid-cols-2 gap-4">
//                       <div>
//                         <h3 className="text-sm font-medium text-muted-foreground">Device Name</h3>
//                         <p className="font-medium">{deviceName || "Not specified"}</p>
//                       </div>
//                       <div>
//                         <h3 className="text-sm font-medium text-muted-foreground">Device Type</h3>
//                         <p className="font-medium">
//                           {deviceTypes.find((t) => t.value === deviceType)?.label || "Not specified"}
//                         </p>
//                       </div>
//                       <div>
//                         <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
//                         <p className="font-medium">{deviceLocation || "Not specified"}</p>
//                       </div>
//                       <div>
//                         <h3 className="text-sm font-medium text-muted-foreground">Data Frequency</h3>
//                         <p className="font-medium">
//                           {dataFrequencies.find((f) => f.value === dataFrequency)?.label || "Not specified"}
//                         </p>
//                       </div>
//                     </div>

//                     <div>
//                       <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
//                       <p className="text-sm">{deviceDescription || "No description provided"}</p>
//                     </div>

//                     <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
//                       <p className="text-sm text-muted-foreground">
//                         <span className="text-secondary font-medium">Note:</span> Registering your device will create a
//                         transaction on the Solana blockchain. A small network fee may apply.
//                       </p>
//                     </div>
//                   </TabsContent>
//                   <TabsContent value="technical" className="space-y-4 pt-4">
//                     <div className="font-mono text-xs p-4 bg-black/50 rounded-lg overflow-x-auto">
//                       <pre>
//                         {`{
//   "device_id": "${Math.random().toString(36).substring(2, 10)}",
//   "owner": "YOUR_WALLET_ADDRESS",
//   "device_name": "${deviceName}",
//   "device_type": "${deviceType}",
//   "location": "${deviceLocation}",
//   "data_specs": {
//     "frequency": "${dataFrequency}",
//     "accuracy": ${dataAccuracy[0]},
//     "format": "JSON"
//   },
//   "registration_time": "${new Date().toISOString()}",
//   "blockchain": "solana",
//   "network": "devnet"
// }`}
//                       </pre>
//                     </div>

//                     <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
//                       <p className="text-sm text-muted-foreground">
//                         <span className="text-primary font-medium">Technical Info:</span> This metadata will be stored
//                         on-chain to verify your device's authenticity and data specifications.
//                       </p>
//                     </div>
//                   </TabsContent>
//                 </Tabs>
//               </CardContent>
//               <CardFooter className="flex justify-between">
//                 <Button variant="outline" onClick={handleBack}>
//                   <ArrowLeft className="mr-2 h-4 w-4" />
//                   Back
//                 </Button>
//                 <Button
//                   onClick={handleRegister}
//                   disabled={isRegistering || isSuccess}
//                   className={`bg-gradient-to-r from-primary to-secondary hover:opacity-90 ${isSuccess ? "bg-green-500" : ""}`}
//                 >
//                   {isRegistering ? (
//                     <>
//                       <RotateCw className="mr-2 h-4 w-4 animate-spin" />
//                       Registering...
//                     </>
//                   ) : isSuccess ? (
//                     <>
//                       <Check className="mr-2 h-4 w-4" />
//                       Registered Successfully
//                     </>
//                   ) : (
//                     <>
//                       Register Device
//                       <ArrowRight className="ml-2 h-4 w-4" />
//                     </>
//                   )}
//                 </Button>
//               </CardFooter>
//             </Card>
//           )}
//         </div>
//       </div>
//     </main>
//   )
// }
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import { Navbar } from '@/components/navbar'
import { useRegisterDevice } from '@/hooks/useRegisterDevice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, ArrowRight, Check, Cpu, MapPin, Activity, RotateCw } from 'lucide-react'
import { EnrollMetadata } from '../index'

const deviceTypes = [
  { value: 'temperature', label: 'Temperature Sensor', units: '°C' },
  { value: 'humidity', label: 'Humidity Sensor', units: '%' },
  { value: 'air-quality', label: 'Air Quality Monitor', units: 'µg/m³' },
  // …add more as needed
]

const dataFrequencies = [
  { value: '0.016Hz', label: 'Every minute' },
  { value: '0.2Hz', label: 'Every 5 minutes' },
  { value: '0.066Hz', label: 'Every 15 minutes' },
  { value: '0.016Hz', label: 'Every 60 minutes' },
]

export default function RegisterDevicePage() {
  const router = useRouter()
  const registerDevice = useRegisterDevice()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [result, setResult] = useState<{
    deviceId: string
    certificatePem: string
    brokerUrl: string
    txSignature: string
  }|null>(null)

  // Form state
  const [csrPem, setCsrPem] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [deviceType, setDeviceType] = useState(deviceTypes[0].value)
  const [deviceLocation, setDeviceLocation] = useState('')
  const [latitude, setLatitude] = useState<number>(0)
  const [longitude, setLongitude] = useState<number>(0)
  const [dataFrequency, setDataFrequency] = useState(dataFrequencies[0].value)
  const [dataAccuracy, setDataAccuracy] = useState<number[]>([90])

  const next = () => setStep(s => Math.min(4, s+1))
  const back = () => setStep(s => Math.max(1, s-1))

  const handleRegister = async () => {
    setLoading(true)
    setError(null)
    try {
      // Build metadata for backend
      const metadata: EnrollMetadata = {
        deviceName,
        model: deviceType,
        location: { latitude, longitude },
        dataTypes: [{
          type: deviceType,
          units: deviceTypes.find(t => t.value===deviceType)?.units || '',
          frequency: dataFrequency
        }],
        pricePerUnit: 1,       // TODO: add real price input
        totalDataUnits: dataAccuracy[0] * 10, // e.g. accuracy slider → units
      }

      const res = await registerDevice(csrPem, metadata)
      setResult(res)
      setStep(5)  // success page
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

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
              <CardDescription>On-chain tx: <code>{result.txSignature}</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Certificate PEM</h4>
                <pre className="p-4 bg-gray-400 text-green-200 rounded overflow-auto text-sm font-mono whitespace-pre-wrap"><code>{result.certificatePem}</code></pre>
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
              <Button onClick={() => router.push('/seller/dashboard')}>
                Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Header & Progress */}
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/seller/dashboard')} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2"/> Back
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
                <CardTitle className="flex items-center"><Cpu className="mr-2"/> Basic Info</CardTitle>
                <CardDescription>Paste your CSR and device details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>CSR (PEM)</Label>
                  <textarea
                    rows={6}
                    className="w-full p-2 border rounded"
                    value={csrPem}
                    onChange={e => setCsrPem(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
                    required
                  />
                </div>
                <div>
                  <Label>Device Name</Label>
                  <Input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Air Sensor #1"/>
                </div>
                <div>
                  <Label>Device Type</Label>
                  <Select value={deviceType} onValueChange={setDeviceType}>
                    <SelectTrigger><SelectValue placeholder="Type"/></SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => router.push('/seller/dashboard')}>Cancel</Button>
                <Button onClick={next} disabled={!csrPem || !deviceName}>Next</Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><MapPin className="mr-2"/> Location</CardTitle>
                <CardDescription>Where is your device?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Location Description</Label><Input value={deviceLocation} onChange={e => setDeviceLocation(e.target.value)} placeholder="Rooftop"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={latitude} onChange={e => setLatitude(parseFloat(e.target.value))}/>
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={longitude} onChange={e => setLongitude(parseFloat(e.target.value))}/>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={back}>Back</Button>
                <Button onClick={next} disabled={!deviceLocation}>Next</Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Activity className="mr-2"/> Data Specs</CardTitle>
                <CardDescription>Configure frequency & accuracy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Frequency</Label>
                  <Select value={dataFrequency} onValueChange={setDataFrequency}>
                    <SelectTrigger><SelectValue placeholder="Frequency"/></SelectTrigger>
                    <SelectContent>
                      {dataFrequencies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
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
                <Button variant="outline" onClick={back}>Back</Button>
                <Button onClick={next}>Next</Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Check className="mr-2"/> Confirm</CardTitle>
                <CardDescription>Review and register</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h4 className="font-medium">Name:</h4><p>{deviceName}</p>
                <h4 className="font-medium">Type:</h4><p>{deviceTypes.find(t=>t.value===deviceType)?.label}</p>
                <h4 className="font-medium">Location:</h4><p>{deviceLocation} ({latitude}, {longitude})</p>
                <h4 className="font-medium">Frequency:</h4><p>{dataFrequency}</p>
                <h4 className="font-medium">Accuracy:</h4><p>{dataAccuracy[0]}%</p>
                {error && <p className="text-red-600">{error}</p>}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={back}>Back</Button>
                <Button onClick={handleRegister} disabled={loading}>
                  {loading
                    ? <><RotateCw className="animate-spin mr-2"/>Registering…</>
                    : 'Register Device'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
