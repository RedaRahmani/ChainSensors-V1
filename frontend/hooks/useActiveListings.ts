import { useState, useEffect } from "react";
import { Listing, ListingStatus } from "@/hooks/types/listing";

export function useActiveListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const response = await fetch("http://localhost:3003/listings/active", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch active listings");

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