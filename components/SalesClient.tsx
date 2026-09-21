"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Combobox } from "@/components/ui/Combobox";
import { NewCustomerDialog } from "@/components/NewCustomerDialog";
import { useToast } from "@/components/ui/Toast";
import { useShopSettings } from "@/lib/settings";
import { formatPKR } from "@/lib/format";
import { recordSale } from "@/app/(pos)/sales/actions";
import { INVENTORY_QUERY_KEY } from "@/lib/queries/inventory";
import { INVOICES_QUERY_KEY } from "@/lib/queries/invoices";
import {
  SALES_CUSTOMERS_KEY,
  SALES_QUERY_KEY,
  salesCategoriesQuery,
  salesCustomersQuery,
  salesProductsQuery,
} from "@/lib/queries/sales";
import { useSupabaseBrowser } from "@/lib/queries/client";
import { discountSchema, type SaleValues } from "@/lib/validation";
import type { Customer, PaymentMethod } from "@/lib/sales";

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  /** Snapshot from the catalogue when the line was added, never re-read. */
  unitPrice: number;
}

/**
 * The till. Products and customers come from the react-query cache (hydrated
 * from the server render); the cart only carries product ids and quantities,
 * and the RPC prices the sale from the catalogue.
 */
export function SalesClient({
  canSell,
  canAddCustomer,
}: {
  canSell: boolean;
  canAddCustomer: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = useSupabaseBrowser();
  const queryClient = useQueryClient();
  const { settings } = useShopSettings();
  const discountType = settings.discountType;

  // The server render dehydrated these exact keys, so the first paint reads
  // from the cache rather than triggering a browser fetch.
  const { data: productData, isPending: productsPending } = useQuery(
    salesProductsQuery(supabase)
  );
  const { data: customerData } = useQuery(salesCustomersQuery(supabase));
  const { data: categoryData } = useQuery(salesCategoriesQuery(supabase));

  const products = useMemo(() => productData ?? [], [productData]);
  const customers = customerData ?? [];
  const categories = categoryData ?? [];

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const [pendingCustomerName, setPendingCustomerName] = useState<string | null>(null);
  const createResolver = useRef<((result: { value: string; label: string } | { error: string }) => void) | null>(null);

  /**
   * `recordSale` reports success with `{ id }`, not the app-wide
   * `{ error, message }`, so `useServerAction` (which keys success off an absent
   * `error` and a present `message`) cannot wrap it. A plain mutation keeps the
   * same contract and wires the invalidation and toast the helper would have.
   */
  const recordSaleMutation = useMutation({
    mutationFn: (input: SaleValues) => recordSale(input),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // A recorded sale adds an invoice and moves stock, so refresh every
      // domain it touched — the browser cache, not just the server render.
      queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });

      setCart([]);
      setDiscount("0");
      setCustomerId("");
      router.push(`/invoices/${result.id}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    },
  });

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
    // Refetch the customers list rather than appending to a local array: the
    // list now lives in the query cache, and a local merge would vanish on the
    // next visit. The invalidation puts the new customer into the query data,
    // which is where the Combobox reads its options from.
    queryClient.invalidateQueries({ queryKey: SALES_CUSTOMERS_KEY });
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
          // Snapshot at add time: a background refetch of the product list must
          // not reprice a line the cashier has already shown the customer.
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

  function completeSale() {
    if (cart.length === 0 || discountError || recordSaleMutation.isPending) return;

    recordSaleMutation.mutate({
      customerId: customerId || null,
      items: cart.map((line) => ({ productId: line.productId, qty: line.qty })),
      discount: discountValue,
      paymentMethod,
      status: "paid",
    });
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
                {productsPending ? "Loading products…" : "No products match your search."}
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
                options={customers.map((customer) => ({
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
              cart.length === 0 ||
              discountError !== null ||
              recordSaleMutation.isPending ||
              !canSell
            }
            onClick={completeSale}
          >
            {recordSaleMutation.isPending ? "Recording…" : "Complete sale"}
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
