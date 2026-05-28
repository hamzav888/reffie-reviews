"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

type PropertyRow = Tables<"properties">;

interface PropertyContextType {
  properties: PropertyRow[];
  selectedProperty: PropertyRow | null;
  setSelectedProperty: (p: PropertyRow) => void;
  refetch: () => Promise<void>;
  loading: boolean;
}

const PropertyContext = createContext<PropertyContextType>({
  properties: [],
  selectedProperty: null,
  setSelectedProperty: () => {},
  refetch: async () => {},
  loading: true,
});

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const supabase = createBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const fetchProperties = useCallback(async () => {
    // Query through property_managers so RLS (user_id = auth.uid()) scopes to
    // only the properties this user manages.
    const { data } = await supabase
      .from("property_managers")
      .select("properties(*)")
      .order("created_at", { ascending: true });

    // Flatten the join result and drop any nulls
    const props = (data ?? [])
      .map((row) => row.properties)
      .filter(
        (p): p is PropertyRow =>
          p !== null && typeof p === "object" && !Array.isArray(p)
      );

    setProperties(props);

    if (props.length > 0) {
      // Keep the current selection if it's still in the new list
      setSelectedProperty((prev) => {
        const stillValid = prev && props.find((p) => p.id === prev.id);
        return stillValid ? prev : props[0];
      });
    } else if (pathname !== "/admin/settings") {
      // No properties yet — send user to settings to create one
      router.push("/admin/settings");
    }

    setLoading(false);
  }, [supabase, pathname, router]);

  useEffect(() => {
    fetchProperties();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PropertyContext.Provider
      value={{
        properties,
        selectedProperty,
        setSelectedProperty,
        refetch: fetchProperties,
        loading,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  return useContext(PropertyContext);
}
