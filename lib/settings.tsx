"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Shop settings are the last thing still held locally. Everything else —
// inventory, stock, purchasing and now sales — lives in Postgres.

export type DiscountType = "amount" | "percentage";

export interface ShopSettings {
  shopName: string;
  shopTagline: string;
  discountType: DiscountType;
}

const STORAGE_KEY = "furniture-pos:settings:v1";
/** The old combined blob, read once so an existing shop name is not lost. */
const LEGACY_KEY = "furniture-pos:v1";

const DEFAULTS: ShopSettings = {
  shopName: "ABC Furniture",
  shopTagline: "Furniture & Home Decor · Pakistan",
  discountType: "amount",
};

function readSettings(): ShopSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ShopSettings>) };

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { settings?: Partial<ShopSettings> };
      if (parsed.settings) return { ...DEFAULTS, ...parsed.settings };
    }
  } catch {
    // Private mode or unreadable storage: fall back to the defaults.
  }
  return DEFAULTS;
}

interface SettingsStore {
  settings: ShopSettings;
  updateSettings: (updates: Partial<ShopSettings>) => void;
}

const SettingsContext = createContext<SettingsStore | null>(null);

export function ShopSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS);
  const hydrated = useRef(false);

  useEffect(() => {
    // One-time read from localStorage after mount, so the server HTML and the
    // first client render stay identical.
    const stored = readSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (an external system) after mount, required to keep SSR/hydration output deterministic
    setSettings(stored);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private mode: the settings just will not persist.
    }
  }, [settings]);

  const value = useMemo<SettingsStore>(
    () => ({
      settings,
      updateSettings: (updates) => setSettings((prev) => ({ ...prev, ...updates })),
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useShopSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useShopSettings must be used within ShopSettingsProvider");
  return ctx;
}
