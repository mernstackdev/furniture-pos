"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Combobox } from "@/components/ui/Combobox";
import { NewCustomerDialog } from "@/components/NewCustomerDialog";
import { useToast } from "@/components/ui/Toast";
import { useShopSettings } from "@/lib/settings";
import { formatPKR } from "@/lib/format";
import { recordSale } from "@/app/(pos)/sales/actions";
import { discountSchema } from "@/lib/validation";
import type { InventoryProduct, Category } from "@/lib/inventory";
import type { Customer, PaymentMethod } from "@/lib/sales";

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

/**
 * The till. Prices and stock come from the server; the cart only carries
 * product ids and quantities, and the RPC prices the sale from the catalogue.
 */
export function SalesClient({
  products,
  customers,
  categories,
  canSell,
  canAddCustomer,
}: {
  products: InventoryProduct[];
  customers: Customer[];
  categories: Category[];
  canSell: boolean;
  canAddCustomer: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { settings } = useShopSettings();
  const discountType = settings.discountType;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);

  // Customers added during this visit, so the new record can be selected
  // immediately without waiting for the page to re-render.
  const [addedCustomers, setAddedCustomers] = useState<Customer[]>([]);
  const [pendingCustomerName, setPendingCustomerName] = useState<string | null>(null);
  const createResolver = useRef<((result: { value: string; label: string } | { error: string }) => void) | null>(null);

  const allCustomers = [...customers, ...addedCustomers];

  /**
   * The Combobox's create row waits on this promise, so it stays in its
   * "Creating…" state until the dialog is submitted or dismissed.
   */
  function requestNewCustomer(name: string) {
    setPendingCustomerName(name);
    return new Promise<{ value: string; label: string } | { error: string }>((resolve) => {
      createResolver.current = resolve;
    });
  }

  function dismissNewCustomer() {
    setPendingCustomerName(null);
    // An empty message tells the Combobox to stop without showing an error.
    createResolver.current?.({ error: "" });
    createResolver.current = null;
  }

  function handleCustomerCreated(customer: Customer) {
    setAddedCustomers((prev) => [...prev, customer]);
    setCustomerId(customer.id);
    setPendingCustomerName(null);
    createResolver.current?.({ value: customer.id, label: customer.name });
    createResolver.current = null;
    toast.success(`${customer.name} added and selected.`);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "All" || product.categoryId === category;
      const matchesSearch =
        !q || product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const subtotal = cart.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const discountValue =
    discountType === "percentage"
      ? subtotal * (Math.max(0, Math.min(100, Number(discount) || 0)) / 100)
      : Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountValue;

  const discountCheck = discountSchema(discountType).safeParse({
    discount: discount.trim() === "" ? undefined : Number(discount),
  });
  const discountError = discountCheck.success
    ? null
    : discountCheck.error.issues[0]?.message ?? "Invalid discount";

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product || product.stockQty === 0) return;

    setCart((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      const currentQty = existing?.qty ?? 0;
      if (currentQty >= product.stockQty) return prev;

      if (existing) {
        return prev.map((line) =>
          line.productId === productId ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [
        ...prev,
        {
          productId,
          name: product.name,
          qty: 1,
          unitPrice: product.sellPrice,
        },
      ];
    });
  }

  function updateQty(productId: string, qty: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const clamped = Math.max(1, Math.min(qty, product.stockQty));
    setCart((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, qty: clamped } : line))
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function completeSale() {
    if (cart.length === 0 || discountError || submitting) return;
    setSubmitting(true);

    const result = await recordSale({
      customerId: customerId || null,
      items: cart.map((line) => ({ productId: line.productId, qty: line.qty })),
      discount: discountValue,
      paymentMethod,
      status: "paid",
    });

    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setCart([]);
    setDiscount("0");
    setCustomerId("");
    router.push(`/invoices/${result.id}`);
  }

  return (
    <div>
      <TopBar title="Sales / New Sale" description="Build a cart and generate an invoice" />
      <div className="grid grid-cols-1 gap-6 p-4 sm:p-8 xl:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="input max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              {["All", ...categories.map((item) => item.id)].map((value) => {
                const label =
                  value === "All"
                    ? "All"
                    : categories.find((item) => item.id === value)?.name ?? value;
                return (
                  <button
                    key={value}
                    onClick={() => setCategory(value)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                      category === value
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-surface text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const outOfStock = product.stockQty === 0;
              return (
                <button
                  key={product.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(product.id)}
                  className="flex cursor-pointer flex-col items-start rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                  <p className="mt-1 font-medium text-foreground">{product.name}</p>
                  <p className="mt-2 text-sm font-semibold text-brand">
                    {formatPKR(product.sellPrice)}
                  </p>
                  <div className="mt-2">
                    <Badge
                      tone={
                        outOfStock
                          ? "danger"
                          : product.stockQty <= product.lowStockThreshold
                            ? "warning"
                            : "success"
                      }
                    >
                      {outOfStock
                        ? "Out of stock"
                        : `${product.stockQty} ${product.unit}(s) left`}
                    </Badge>
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                No products match your search.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Cart</h2>
          <div className="space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cart is empty. Click a product to add it.
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.productId}
                  className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPKR(line.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(line.productId, line.qty - 1)}
                      className="h-6 w-6 cursor-pointer rounded border border-border text-sm"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{line.qty}</span>
                    <button
                      onClick={() => updateQty(line.productId, line.qty + 1)}
                      className="h-6 w-6 cursor-pointer rounded border border-border text-sm"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(line.productId)}
                      className="ml-1 cursor-pointer text-danger text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Customer</span>
              <Combobox
                options={allCustomers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                  hint: customer.phone,
                }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Walk-in customer"
                emptyLabel="No customers match"
                clearLabel="Walk-in customer"
                onCreate={canAddCustomer ? requestNewCustomer : undefined}
                actionLabel={canAddCustomer ? "+ Add new customer" : undefined}
                onAction={canAddCustomer ? () => setPendingCustomerName("") : undefined}
              />
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Discount {discountType === "percentage" ? "(%)" : "(PKR)"}
              </span>
              <input
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="input"
              />
              {discountError ? (
                <span className="mt-1 block text-xs text-danger">{discountError}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Payment method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="input"
              >
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

          <Button
            className="mt-4 w-full"
            disabled={
              cart.length === 0 || discountError !== null || submitting || !canSell
            }
            onClick={completeSale}
          >
            {submitting ? "Recording…" : "Complete sale"}
          </Button>

          {!canSell ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You have read-only access to sales.
            </p>
          ) : null}
        </aside>
      </div>

      {pendingCustomerName !== null ? (
        <NewCustomerDialog
          key={pendingCustomerName}
          initialName={pendingCustomerName}
          onCreated={handleCustomerCreated}
          onCancel={dismissNewCustomer}
        />
      ) : null}
    </div>
  );
}
