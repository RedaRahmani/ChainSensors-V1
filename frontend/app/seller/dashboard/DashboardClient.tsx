"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, LineChart, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
// Commented out temporarily to isolate issues
// import { useCreateListing } from "@/hooks/useCreateListing";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useMyListings } from "@/hooks/useMyListings";
import { DeviceRecord } from "@/hooks/types/device";
import { Listing, ListingStatus } from "@/hooks/types/listing";

export default function DashboardClient() {
  const router = useRouter();
  const { connected, userType, publicKey } = useWalletContext();
  const { devices, isLoading: devicesLoading } = useMyDevices(
    publicKey?.toString() || null
  );
  const { listings, isLoading: listingsLoading, isError } = useMyListings(
    publicKey?.toString() || null
  );

  const [totalEarnings, setTotalEarnings] = useState(0);
  const [activeListings, setActiveListings] = useState(0);
  const [totalDevices, setTotalDevices] = useState(0);
  const [salesGrowth, setSalesGrowth] = useState(0);

  useEffect(() => {
    if (!connected || !publicKey) {
      router.push("/");
      return;
    }
    if (userType !== "seller") {
      router.push("/");
      return;
    }

    if (listings && devices) {
      const activeListingsCount = listings.filter(
        (l) => l.status === ListingStatus.Active
      ).length;
      const earnings = listings
        .filter((l) => l.status === ListingStatus.Active)
        .reduce(
          (sum: number, l: Listing) => sum + l.pricePerUnit * l.totalDataUnits,
          0
        );
      const devicesCount = devices.length;

      const monthlyEarnings = getMonthlyEarnings(listings);
      const lastMonth = monthlyEarnings[monthlyEarnings.length - 1]?.amount || 0;
      const prevMonth = monthlyEarnings[monthlyEarnings.length - 2]?.amount || 0;
      const growth =
        prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

      setActiveListings(activeListingsCount);
      setTotalEarnings(earnings);
      setTotalDevices(devicesCount);
      setSalesGrowth(growth);
    }
  }, [connected, userType, router, publicKey, listings, devices]);

  function getMonthlyEarnings(
    listings: Listing[]
  ): { month: string; amount: number }[] {
    const monthlyMap = listings.reduce((acc, listing) => {
      if (listing.status !== ListingStatus.Active) return acc;
      const createdAt = new Date(listing.createdAt);
      const month = createdAt.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      const earnings = listing.pricePerUnit * listing.totalDataUnits;
      acc[month] = (acc[month] || 0) + earnings;
      return acc;
    }, {} as Record<string, number>);

    const months: { month: string; amount: number }[] = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const month = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      months.push({ month, amount: monthlyMap[month] || 0 });
    }
    return months;
  }

  // SAFER: some devices may lack metadata or dataTypes
  const deviceTypes = (devices ?? []).reduce((acc, dev: any) => {
    const meta = dev?.metadata || {};
    const typesArr = Array.isArray(meta.dataTypes) ? meta.dataTypes : [];
    const firstType = typesArr.length > 0 ? typesArr[0]?.type : undefined;

    // fallbacks: explicit metadata.type, or model, or "Unknown"
    const type = firstType ?? meta.type ?? dev?.model ?? "Unknown";

    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deviceData = Object.entries(deviceTypes || {}).map(
    ([type, count]) => ({
      type,
      count,
    })
  );

  const listingStatuses = listings?.reduce(
    (acc: { [key: string]: number }, listing: Listing) => {
      const statusLabel = ListingStatus[listing.status] as string;
      acc[statusLabel] = (acc[statusLabel] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number }
  );

  const listingsData = Object.entries(listingStatuses || {}).map(
    ([status, count]) => ({
      status,
      count: count as number,
    })
  );

  const earningsData = getMonthlyEarnings(listings || []);

  if (devicesLoading || listingsLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error loading listings. Please try again later.</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your IoT devices and data listings
            </p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Button
              onClick={() => router.push("/seller/devices/register")}
              className="bg-primary hover:bg-primary/90"
            >
              Register Device
            </Button>
            <Button
              onClick={() => router.push("/seller/listings")}
              className="bg-secondary hover:bg-secondary/90"
            >
              Create Listing
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Earnings"
            value={`${totalEarnings.toFixed(2)} usdc`}
            description="Potential earnings from active listings"
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
            description="Average rating from buyers (TBD)"
            icon={<StarIcon className="h-5 w-5 text-secondary" />}
            className="border-secondary/20 shadow-sm shadow-secondary/10"
          />
        </div>

        {/* Tabs for Charts and Listings */}
        <Tabs defaultValue="earnings" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger
              value="earnings"
              className="data-[state=active]:bg-primary/20"
            >
              <LineChart className="mr-2 h-4 w-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger
              value="devices"
              className="data-[state=active]:bg-secondary/20"
            >
              <PieChart className="mr-2 h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger
              value="listings"
              className="data-[state=active]:bg-primary/20"
            >
              <BarChart className="mr-2 h-4 w-4" />
              Listings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Potential Earnings (usdc)</CardTitle>
                <CardDescription>
                  Your potential earnings over the past 6 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <EarningsChart data={earningsData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle>Device Distribution</CardTitle>
                <CardDescription>
                  Breakdown of your registered IoT devices by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <DevicesChart data={deviceData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle>Listing Status</CardTitle>
                <CardDescription>
                  Overview of your data listings by status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ListingsChart data={listingsData} />
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Your Listings</h3>
                  {listings && listings.length > 0 ? (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted">
                          <th className="p-2 text-left">Listing ID</th>
                          <th className="p-2 text-left">Device ID</th>
                          <th className="p-2 text-left">Price/Unit</th>
                          <th className="p-2 text-left">Total Units</th>
                          <th className="p-2 text-left">Status</th>
                          <th className="p-2 text-left">Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listings.map((listing: Listing) => (
                          <tr key={listing._id} className="border-b">
                            <td className="p-2">{listing.listingId}</td>
                            <td className="p-2">{listing.deviceId}</td>
                            <td className="p-2">{listing.pricePerUnit} usdc</td>
                            <td className="p-2">{listing.totalDataUnits}</td>
                            <td className="p-2">
                              {ListingStatus[listing.status]}
                            </td>
                            <td className="p-2">
                              {new Date(listing.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No listings found. Create a listing to get started!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
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
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  className?: string;
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
          <div
            className={cn(
              "text-xs mt-2",
              trend >= 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {trend >= 0 ? "↑" : "↓"} {trendLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
  );
}

function EarningsChart({
  data,
}: {
  data: { month: string; amount: number }[];
}) {
  const safeData = Array.isArray(data) ? data : [];
  const maxAmount = Math.max(...safeData.map((item) => item.amount), 1);
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end">
        <div className="w-full flex justify-between items-end h-full">
          {safeData.map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className="w-12 bg-gradient-to-t from-primary/50 to-primary rounded-t-md"
                style={{ height: `${(item.amount / maxAmount) * 100}%` }}
              ></div>
              <div className="text-xs mt-2">{item.month}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Total:{" "}
        {safeData
          .reduce((sum, item) => sum + item.amount, 0)
          .toFixed(2)}{" "}
        usdc
      </div>
    </div>
  );
}

function DevicesChart({ data }: { data: { type: string; count: number }[] }) {
  const safeData = Array.isArray(data) ? data : [];
  const total = safeData.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-48 h-48 rounded-full relative">
        {safeData.map((item, index) => {
          const percentage = (item.count / total) * 100;
          const color = index % 2 === 0 ? "bg-primary" : "bg-secondary";
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
          );
        })}
      </div>
      <div className="ml-8">
        {safeData.map((item, index) => (
          <div key={index} className="flex items-center mb-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${
                index % 2 === 0 ? "bg-primary" : "bg-secondary"
              }`}
            ></div>
            <div className="text-sm">
              {item.type}: {item.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingsChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const safeData = Array.isArray(data) ? data : [];
  const maxCount = Math.max(...safeData.map((item) => item.count), 1);
  return (
    <div className="w-full h-full flex items-end justify-around">
      {safeData.map((item, index) => (
        <div key={index} className="flex flex-col items-center">
          <div className="text-sm mb-2">{item.count}</div>
          <div
            className={`w-24 ${
              item.status === "Active"
                ? "bg-secondary"
                : item.status === "Pending"
                ? "bg-yellow-500"
                : "bg-primary"
            } rounded-t-md`}
            style={{ height: `${(item.count / maxCount) * 200}px` }}
          ></div>
          <div className="text-sm mt-2">{item.status}</div>
        </div>
      ))}
    </div>
  );
}
