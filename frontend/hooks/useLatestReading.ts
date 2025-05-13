// frontend/hooks/useLatestReading.ts
import { useState, useEffect } from "react";

export function useLatestReading(deviceId: string) {
  const [reading, setReading] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchReading = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const response = await fetch(`http://localhost:3003/readings/${deviceId}?limit=2`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch readings");

        const data = await response.json();
        if (data.length > 0) {
          const readings = await Promise.all(
            data.slice(0, 2).map(async (item: any) => {
              const walrusResponse = await fetch(`http://localhost:3003/readings/${deviceId}/raw/${item.dataCid}`);
              if (!walrusResponse.ok) throw new Error("Failed to fetch raw data from Walrus");
              return walrusResponse.json();
            })
          );
          setReading(readings);
        } else {
          setReading([]);
        }
      } catch (error) {
        console.error("Error fetching latest readings:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (deviceId) fetchReading();
  }, [deviceId]);

  return { reading, isLoading, isError };
}