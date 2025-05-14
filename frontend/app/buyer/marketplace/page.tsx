// app/buyer/marketplace/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { redirect } from "next/navigation";
import BuyerMarketplaceClient from "./BuyerMarketplaceClient";

export default async function BuyerMarketplacePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin");
  }

  return <BuyerMarketplaceClient />;
}