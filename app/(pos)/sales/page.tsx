"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppData } from "@/lib/store";
import { formatPKR } from "@/lib/format";
import type { PaymentMethod, ProductCategory, SaleItem } from "@/lib/types";

const categories: (ProductCategory | "All")[] = ["All", "Sofas", "Beds", "Dining", "Wardrobes", "Chairs", "Tables", "Decor"];

export default function SalesPage() {
  const { products, customers, settings, createSale } = useAppData();
  const router = useRouter();
  const discountType = settings.discountType;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountValue =
    discountType === "percentage"
      ? subtotal * (Math.max(0, Math.min(100, Number(discount) || 0)) / 100)
      : Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountValue;

  function addToCart(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product || product.stockQty === 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      const currentQty = existing?.qty ?? 0;
      if (currentQty >= product.stockQty) return prev;
      if (existing) {
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        { productId, name: product.name, qty: 1, unitPrice: product.sellPrice, lineTotal: product.sellPrice },
      ];
    });
  }

  function updateQty(productId: string, qty: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const clamped = Math.max(1, Math.min(qty, product.stockQty));
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: clamped, lineTotal: clamped * i.unitPrice } : i))
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function completeSale() {
    if (cart.length === 0) return;
    const sale = createSale({
      customerId: customerId || null,
      items: cart,
      discount: discountValue,
      paymentMethod,
      status: "paid",
    });
    setCart([]);
    setDiscount("0");
    setCustomerId("");
    router.push(`/invoices/${sale.id}`);
  }

  return (
    <div>
      <TopBar title="Sales / New Sale" description="Build a cart and generate an invoice" />
      <div className="grid grid-cols-1 gap-6 p-4 sm:p-8 xl:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="input max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    category === c
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((p) => {
              const outOfStock = p.stockQty === 0;
              return (
                <button
                  key={p.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(p.id)}
                  className="flex flex-col items-start rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className="mt-1 font-medium text-foreground">{p.name}</p>
                  <p className="mt-2 text-sm font-semibold text-brand">{formatPKR(p.sellPrice)}</p>
                  <div className="mt-2">
                    <Badge tone={outOfStock ? "danger" : p.stockQty <= p.lowStockThreshold ? "warning" : "success"}>
                      {outOfStock ? "Out of stock" : `${p.stockQty} ${p.unit}(s) left`}
                    </Badge>
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products match your search.</p>
            ) : null}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Cart</h2>
          <div className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty. Click a product to add it.</p>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPKR(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.productId, item.qty - 1)} className="h-6 w-6 rounded border border-border text-sm">-</button>
                    <span className="w-6 text-center text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.productId, item.qty + 1)} className="h-6 w-6 rounded border border-border text-sm">+</button>
                    <button onClick={() => removeFromCart(item.productId)} className="ml-1 text-danger text-xs">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Customer</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Discount {discountType === "percentage" ? "(%)" : "(PKR)"}
              </span>
              <input
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="input"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Payment method</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="input">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPKR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatPKR(discountValue)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatPKR(total)}</span>
            </div>
          </div>

          <Button className="mt-4 w-full" disabled={cart.length === 0} onClick={completeSale}>
            Complete sale
          </Button>
        </aside>
      </div>
    </div>
  );
}
