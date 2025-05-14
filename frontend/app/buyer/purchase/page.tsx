
// app/buyer/purchase/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { redirect } from "next/navigation";
import PurchaseClient from "./PurchaseClient";

export default async function PurchasePage() {
  // Validate NextAuth session on the server
  const session = await getServerSession(authOptions);
  if (!session) {
    // No session? Redirect to sign-in
    redirect("/api/auth/signin");
  }

  // Auth OK → Render the client UI
  return <PurchaseClient />;
}
