import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { redirect } from "next/navigation";
import RegisterDeviceClient from "./RegisterDeviceClient";

export default async function RegisterDevicePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin");
  }

  return <RegisterDeviceClient />;
}