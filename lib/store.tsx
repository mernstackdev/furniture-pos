"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AppData,
  Customer,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
  ShopSettings,
  StockMovement,
  StockMovementType,
} from "./types";
import { mockAppData } from "./mockData";

const STORAGE_KEY = "furniture-pos:v1";

function readFromStorage(): AppData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.products || !parsed.customers || !parsed.sales || !parsed.stockMovements) {
      return null;
    }
    // Older saved data may predate the settings field.
    return { ...mockAppData, ...parsed, settings: { ...mockAppData.settings, ...parsed.settings } };
  } catch {
    return null;
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface NewSaleInput {
  customerId: string | null;
  items: SaleItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  status: "paid" | "unpaid";
}

interface AppStore extends AppData {
  addProduct: (product: Omit<Product, "id" | "createdAt">) => void;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id">>) => void;
  deleteProduct: (id: string) => void;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => void;
  updateCustomer: (id: string, updates: Partial<Omit<Customer, "id">>) => void;
  deleteCustomer: (id: string) => void;
  adjustStock: (productId: string, type: StockMovementType, qty: number, reason: string) => void;
  createSale: (input: NewSaleInput) => Sale;
  updateSettings: (updates: Partial<ShopSettings>) => void;
  resetToSampleData: () => void;
}

const AppDataContext = createContext<AppStore | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(mockAppData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reads previously-saved data from localStorage once, after the initial
    // (SSR-matching) render, to avoid a hydration mismatch.
    const stored = readFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (an external system) after mount, required to keep SSR/hydration output deterministic
    if (stored) setData(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const addProduct = useCallback((product: Omit<Product, "id" | "createdAt">) => {
    setData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        { ...product, id: makeId("p"), createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Omit<Product, "id">>) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  }, []);

  const addCustomer = useCallback((customer: Omit<Customer, "id" | "createdAt">) => {
    setData((prev) => ({
      ...prev,
      customers: [
        ...prev.customers,
        { ...customer, id: makeId("c"), createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const updateCustomer = useCallback((id: string, updates: Partial<Omit<Customer, "id">>) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  }, []);

  const adjustStock = useCallback(
    (productId: string, type: StockMovementType, qty: number, reason: string) => {
      setData((prev) => {
        const delta = type === "out" ? -Math.abs(qty) : qty;
        const movement: StockMovement = {
          id: makeId("m"),
          productId,
          type,
          qty: type === "adjustment" ? qty : Math.abs(qty),
          reason,
          date: new Date().toISOString(),
        };
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? { ...p, stockQty: Math.max(0, p.stockQty + delta) }
              : p
          ),
          stockMovements: [movement, ...prev.stockMovements],
        };
      });
    },
    []
  );

  const createSale = useCallback(
    (input: NewSaleInput): Sale => {
      const subtotal = input.items.reduce((sum, item) => sum + item.lineTotal, 0);
      const total = Math.max(0, subtotal - input.discount);
      const sale: Sale = {
        id: makeId("s"),
        invoiceNo: `INV-${1001 + data.sales.length}`,
        date: new Date().toISOString(),
        customerId: input.customerId,
        items: input.items,
        subtotal,
        discount: input.discount,
        total,
        paymentMethod: input.paymentMethod,
        status: input.status,
      };
      setData((prev) => {
        const movements: StockMovement[] = input.items.map((item) => ({
          id: makeId("m"),
          productId: item.productId,
          type: "out",
          qty: item.qty,
          reason: `Sale ${sale.invoiceNo}`,
          date: sale.date,
        }));
        return {
          ...prev,
          sales: [sale, ...prev.sales],
          products: prev.products.map((p) => {
            const item = input.items.find((i) => i.productId === p.id);
            return item ? { ...p, stockQty: Math.max(0, p.stockQty - item.qty) } : p;
          }),
          stockMovements: [...movements, ...prev.stockMovements],
        };
      });
      return sale;
    },
    [data.sales.length]
  );

  const updateSettings = useCallback((updates: Partial<ShopSettings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...updates } }));
  }, []);

  const resetToSampleData = useCallback(() => {
    setData(mockAppData);
  }, []);

  const value = useMemo<AppStore>(
    () => ({
      ...data,
      addProduct,
      updateProduct,
      deleteProduct,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      adjustStock,
      createSale,
      updateSettings,
      resetToSampleData,
    }),
    [
      data,
      addProduct,
      updateProduct,
      deleteProduct,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      adjustStock,
      createSale,
      updateSettings,
      resetToSampleData,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
