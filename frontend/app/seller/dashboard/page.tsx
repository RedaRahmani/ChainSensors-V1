"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWalletContext } from "@/components/wallet-context-provider"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, LineChart, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data for charts
const mockEarningsData = [
  { month: "Jan", amount: 0.5 },
  { month: "Feb", amount: 1.2 },
  { month: "Mar", amount: 0.8 },
  { month: "Apr", amount: 1.5 },
  { month: "May", amount: 2.1 },
  { month: "Jun", amount: 1.9 },
]

const mockDeviceData = [
  { type: "Temperature", count: 5 },
  { type: "Humidity", count: 3 },
  { type: "Air Quality", count: 2 },
  { type: "Soil Moisture", count: 4 },
]

const mockListingsData = [
  { status: "Active", count: 8 },
  { status: "Pending", count: 2 },
  { status: "Sold", count: 12 },
]

export default function SellerDashboard() {
  const router = useRouter()
  const { connected, userType } = useWalletContext()
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [activeListings, setActiveListings] = useState(0)
  const [totalDevices, setTotalDevices] = useState(0)
  const [salesGrowth, setSalesGrowth] = useState(0)

  useEffect(() => {
    if (!connected) {
      router.push("/")
      return
    }

    if (userType !== "seller") {
      router.push("/")
      return
    }

    // Calculate dashboard stats from mock data
    setTotalEarnings(mockEarningsData.reduce((sum, item) => sum + item.amount, 0))
    setActiveListings(mockListingsData.find((item) => item.status === "Active")?.count || 0)
    setTotalDevices(mockDeviceData.reduce((sum, item) => sum + item.count, 0))

    // Calculate growth (comparing last two months)
    const lastMonth = mockEarningsData[mockEarningsData.length - 1].amount
    const previousMonth = mockEarningsData[mockEarningsData.length - 2].amount
    const growth = previousMonth > 0 ? ((lastMonth - previousMonth) / previousMonth) * 100 : 100
    setSalesGrowth(growth)
  }, [connected, userType, router])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-muted-foreground">Manage your IoT devices and data listings</p>
          </div>

          <div className="flex gap-4 mt-4 md:mt-0">
            <Button onClick={() => router.push("/seller/devices/register")} className="bg-primary hover:bg-primary/90">
              Register Device
            </Button>
            <Button
              onClick={() => router.push("/seller/listings/create")}
              className="bg-secondary hover:bg-secondary/90"
            >
              Create Listing
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Earnings"
            value={`${totalEarnings.toFixed(2)} SOL`}
            description="Lifetime earnings from data sales"
            icon={<LineChart className="h-5 w-5 text-primary" />}
            trend={salesGrowth}
            trendLabel={`${salesGrowth.toFixed(1)}% from last month`}
            className="border-primary/20 shadow-sm shadow-primary/10"
          />

          <StatsCard
            title="Active Listings"
            value={activeListings.toString()}
            description="Currently available data streams"
            icon={<BarChart className="h-5 w-5 text-secondary" />}
            className="border-secondary/20 shadow-sm shadow-secondary/10"
          />

          <StatsCard
            title="Registered Devices"
            value={totalDevices.toString()}
            description="Total connected IoT devices"
            icon={<PieChart className="h-5 w-5 text-primary" />}
            className="border-primary/20 shadow-sm shadow-primary/10"
          />

          <StatsCard
            title="Buyer Rating"
            value="4.8/5"
            description="Average rating from buyers"
            icon={<StarIcon className="h-5 w-5 text-secondary" />}
            className="border-secondary/20 shadow-sm shadow-secondary/10"
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="earnings" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="earnings" className="data-[state=active]:bg-primary/20">
              <LineChart className="mr-2 h-4 w-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-secondary/20">
              <PieChart className="mr-2 h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="listings" className="data-[state=active]:bg-primary/20">
              <BarChart className="mr-2 h-4 w-4" />
              Listings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Earnings (SOL)</CardTitle>
                <CardDescription>Your earnings over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <EarningsChart data={mockEarningsData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle>Device Distribution</CardTitle>
                <CardDescription>Breakdown of your registered IoT devices by type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <DevicesChart data={mockDeviceData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle>Listing Status</CardTitle>
                <CardDescription>Overview of your data listings by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ListingsChart data={mockListingsData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  className,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend !== undefined && (
          <div className={cn("text-xs mt-2", trend >= 0 ? "text-green-500" : "text-red-500")}>
            {trend >= 0 ? "↑" : "↓"} {trendLabel}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// Mock chart components - in a real app, you would use a charting library like Chart.js or Recharts
function EarningsChart({ data }: { data: { month: string; amount: number }[] }) {
  const maxAmount = Math.max(...data.map((item) => item.amount))

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end">
        <div className="w-full flex justify-between items-end h-full">
          {data.map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className="w-12 bg-gradient-to-t from-primary-500/50 to-primary-500 rounded-t-md"
                style={{ height: `${(item.amount / maxAmount) * 100}%` }}
              ></div>
              <div className="text-xs mt-2">{item.month}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Total: {data.reduce((sum, item) => sum + item.amount, 0).toFixed(2)} SOL
      </div>
    </div>
  )
}

function DevicesChart({ data }: { data: { type: string; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-48 h-48 rounded-full relative">
        {data.map((item, index) => {
          const percentage = (item.count / total) * 100
          const color = index % 2 === 0 ? "bg-primary-500" : "bg-secondary-500"

          return (
            <div
              key={index}
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${color} rounded-full`}
              style={{
                width: `${percentage}%`,
                height: `${percentage}%`,
                opacity: 0.7 - index * 0.1,
              }}
            >
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold">
                {item.type}
              </div>
            </div>
          )
        })}
      </div>
      <div className="ml-8">
        {data.map((item, index) => (
          <div key={index} className="flex items-center mb-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${index % 2 === 0 ? "bg-primary-500" : "bg-secondary-500"}`}
            ></div>
            <div className="text-sm">
              {item.type}: {item.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListingsChart({ data }: { data: { status: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((item) => item.count))

  return (
    <div className="w-full h-full flex items-end justify-around">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center">
          <div className="text-sm mb-2">{item.count}</div>
          <div
            className={`w-24 ${
              item.status === "Active"
                ? "bg-secondary-500"
                : item.status === "Pending"
                  ? "bg-yellow-500"
                  : "bg-primary-500"
            } rounded-t-md`}
            style={{ height: `${(item.count / maxCount) * 200}px` }}
          ></div>
          <div className="text-sm mt-2">{item.status}</div>
        </div>
      ))}
    </div>
  )
}
