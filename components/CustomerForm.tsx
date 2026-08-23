"use client";

import { useState } from "react";
import type { Customer } from "@/lib/types";
import { Button } from "./ui/Button";

interface CustomerFormProps {
  initial?: Customer;
  onSubmit: (values: Omit<Customer, "id" | "createdAt">) => void;
  onCancel: () => void;
}

export function CustomerForm({ initial, onSubmit, onCancel }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, phone, address });
      }}
      className="space-y-4"
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Full name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Phone number</span>
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="03XX-XXXXXXX" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Address</span>
        <textarea required value={address} onChange={(e) => setAddress(e.target.value)} className="input" rows={3} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? "Save changes" : "Add customer"}</Button>
      </div>
    </form>
  );
}
