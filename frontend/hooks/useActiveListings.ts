import { useState, useEffect } from "react";
import { Listing } from "@/hooks/types/listing";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export function useActiveListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const response = await fetch(`${API_ROOT.replace(/\/$/, "")}/listings/active`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error(`Failed to fetch active listings: ${response.status}`);
        const data: Listing[] = await response.json();
        setListings(data);
      } catch (error) {
        console.error("Error fetching active listings:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  return { listings, isLoading, isError };
}
