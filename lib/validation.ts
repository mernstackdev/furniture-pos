import { z } from "zod";

// Shared by the browser forms (via react-hook-form) and by the Server Actions,
// so a payload that bypasses the form is still rejected and the client and
// server can never disagree about what is valid.
//
// Deliberately free of z.preprocess / z.transform: those change a schema's
// *input* type, which makes react-hook-form's generics fight the field types.
// Number fields stay `number -> number`, which is why number inputs must be
// registered with `{ valueAsNumber: true }`.

/**
 * A required number. With `valueAsNumber` an empty input yields NaN, and a
 * `type="number"` input cannot hold anything else, so both messages say
 * "required" rather than the confusing "expected number, received nan".
 */
const requiredNumber = (label: string, min = 0, integer = false) => {
  const base = z.number({
    required_error: `${label} is required`,
    invalid_type_error: `${label} is required`,
  });
  return (integer ? base.int(`${label} must be a whole number`) : base).min(
    min,
    `${label} cannot be less than ${min}`
  );
};

// Auth ---------------------------------------------------------------------

export const signInSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const setupSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
});

export const passwordChangeSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string().min(1, "Confirm the new password"),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "cashier"], { errorMap: () => ({ message: "Choose a role" }) }),
});

export const passwordResetSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Inventory ----------------------------------------------------------------

export const productSchema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  name: z.string().trim().min(1, "Product name is required"),
  sku: z.string().trim().min(1, "SKU is required").max(40, "SKU is too long"),
  unit: z.string().trim().min(1, "Unit is required").max(12, "Unit is too long"),
  costPrice: requiredNumber("Cost price", 0),
  sellPrice: requiredNumber("Sell price", 0),
  stockQty: requiredNumber("Stock quantity", 0, true),
  lowStockThreshold: requiredNumber("Low stock threshold", 0, true),
  reorderPoint: requiredNumber("Reorder point", 0, true),
});

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name is required")
  .max(60, "Category name is too long");

export const stockAdjustSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  type: z.enum(["in", "out", "adjustment"], {
    errorMap: () => ({ message: "Choose a movement type" }),
  }),
  qty: requiredNumber("Quantity", -1000000, true).refine((value) => value !== 0, {
    message: "Quantity cannot be zero",
  }),
  reason: z.string().trim().max(200, "Reason is too long").optional(),
});

/** Both bounds optional, but a max below a min silently returns nothing. */
export const priceRangeSchema = z
  .object({
    minPrice: z.number().min(0, "Minimum price cannot be negative").optional(),
    maxPrice: z.number().min(0, "Maximum price cannot be negative").optional(),
  })
  .refine(
    (values) =>
      values.minPrice === undefined ||
      values.maxPrice === undefined ||
      values.minPrice <= values.maxPrice,
    { path: ["maxPrice"], message: "Maximum must not be below the minimum" }
  );

// Purchasing ---------------------------------------------------------------

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required"),
  // Pakistani mobile numbers: 03XX-XXXXXXX, dash optional.
  phone: z
    .string()
    .trim()
    .regex(/^03\d{2}-?\d{7}$/, "Use a mobile number like 0300-1234567"),
  city: z.string().trim().max(60, "City is too long").optional(),
  address: z.string().trim().max(300, "Address is too long").optional(),
  notes: z.string().trim().max(300, "Notes are too long").optional(),
});

export const vendorPaymentSchema = z.object({
  vendorId: z.string().min(1, "Pick a vendor"),
  /** Optional: which bill this settles. Empty means paid on account. */
  purchaseOrderId: z.string().optional(),
  amount: requiredNumber("Amount", 0).refine((value) => value > 0, {
    message: "Amount must be more than zero",
  }),
  method: z.enum(["cash", "bank", "cheque", "online"], {
    errorMap: () => ({ message: "Choose a payment method" }),
  }),
  reference: z.string().trim().max(60, "Reference is too long").optional(),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  qty: requiredNumber("Quantity", 1, true),
  unitCost: requiredNumber("Unit cost", 0),
});

export const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, "Choose a vendor"),
  reference: z.string().trim().max(40, "Reference is too long").optional(),
  notes: z.string().trim().max(300, "Notes are too long").optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one product"),
});

// Local-store forms --------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z
    .string()
    .trim()
    .regex(/^03\d{2}-?\d{7}$/, "Use a mobile number like 0300-1234567"),
  address: z.string().trim().min(1, "Address is required").max(300, "Address is too long"),
});

export const settingsSchema = z.object({
  shopName: z.string().trim().min(1, "Shop name is required").max(80, "Shop name is too long"),
  shopTagline: z.string().trim().max(120, "Tagline is too long"),
  discountType: z.enum(["amount", "percentage"], {
    errorMap: () => ({ message: "Choose a discount type" }),
  }),
});

/** Sales discount: a rupee amount, or a percentage capped at 100. */
export const discountSchema = (discountType: "amount" | "percentage") =>
  z.object({
    discount: requiredNumber("Discount", 0).refine(
      (value) => discountType !== "percentage" || value <= 100,
      { message: "Percentage cannot exceed 100" }
    ),
  });

// Sales --------------------------------------------------------------------

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  qty: requiredNumber("Quantity", 1, true),
});

export const saleSchema = z.object({
  /** null is a walk-in customer. */
  customerId: z.string().uuid("Pick a customer").nullable(),
  items: z.array(saleItemSchema).min(1, "Add at least one product to the cart"),
  discount: requiredNumber("Discount", 0),
  paymentMethod: z.enum(["cash", "card", "bank"], {
    errorMap: () => ({ message: "Choose a payment method" }),
  }),
  status: z.enum(["paid", "unpaid"], {
    errorMap: () => ({ message: "Choose a status" }),
  }),
});

// Inferred types -----------------------------------------------------------

export type SignInValues = z.infer<typeof signInSchema>;
export type SetupValues = z.infer<typeof setupSchema>;
export type ProfileNameValues = z.infer<typeof profileNameSchema>;
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
export type StaffCreateValues = z.infer<typeof staffCreateSchema>;
export type PasswordResetValues = z.infer<typeof passwordResetSchema>;
export type ProductValues = z.infer<typeof productSchema>;
export type StockAdjustValues = z.infer<typeof stockAdjustSchema>;
export type VendorValues = z.infer<typeof vendorSchema>;
export type PurchaseOrderValues = z.infer<typeof purchaseOrderSchema>;
export type VendorPaymentValues = z.infer<typeof vendorPaymentSchema>;
export type SaleValues = z.infer<typeof saleSchema>;
export type CustomerValues = z.infer<typeof customerSchema>;
export type SettingsValues = z.infer<typeof settingsSchema>;

/** Server-side counterpart: turns a ZodError into one user-facing message. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
