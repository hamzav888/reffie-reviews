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
    // Step 1: get the property IDs this user manages.
    // RLS on property_managers enforces user_id = auth.uid(), so this is
    // already scoped to the current user — no explicit filter needed.
    const { data: managerRows } = await supabase
      .from("property_managers")
      .select("property_id")
      .order("created_at", { ascending: true });

    const ids = (managerRows ?? []).map((r) => r.property_id);

    // Step 2: fetch the full property rows by those IDs.
    // Using a separate .in() query avoids the embedded-join response shape
    // ambiguity (isOneToOne: false causes supabase-js to return PropertyRow[]
    // per row, which the old flatten filter would silently discard).
    let props: PropertyRow[] = [];
    if (ids.length > 0) {
      const { data: propsData } = await supabase
        .from("properties")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: true });

      props = propsData ?? [];
    }

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
