// FormData readers used by the Server Actions.
//
// Deliberately NOT in a "use client" module: Server Actions cannot import
// values from a client module, they would be treated as client references.

export function formString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return raw === null ? "" : String(raw);
}

/** `undefined` rather than 0 for an absent field, so "required" can fire. */
export function formNumber(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return undefined;
  const value = Number(raw);
  return Number.isNaN(value) ? undefined : value;
}
