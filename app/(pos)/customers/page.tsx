"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "@/components/CustomerForm";
import { useAppData } from "@/lib/store";
import { formatPKR, formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { customers, sales, addCustomer, updateCustomer, deleteCustomer } = useAppData();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  const totalSpent = (customerId: string) =>
    sales.filter((s) => s.customerId === customerId).reduce((sum, s) => sum + s.total, 0);

  const viewingHistory = viewing ? sales.filter((s) => s.customerId === viewing.id) : [];

  return (
    <div>
      <TopBar
        title="Customer Management"
        description="Keep track of customers and their purchase history"
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Add customer</Button>}
      />
      <div className="space-y-4 p-4 sm:p-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="input max-w-sm"
        />
        <DataTable
          rowKey={(c) => c.id}
          rows={filtered}
          emptyMessage="No customers found."
          onRowClick={(c) => setViewing(c)}
          columns={[
            { header: "Name", render: (c) => <span className="font-medium text-foreground">{c.name}</span> },
            { header: "Phone", render: (c) => c.phone },
            { header: "Address", render: (c) => <span className="text-muted-foreground">{c.address}</span> },
            { header: "Total spent", render: (c) => formatPKR(totalSpent(c.id)) },
            {
              header: "",
              render: (c) => (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" onClick={() => { setEditing(c); setModalOpen(true); }}>Edit</Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"?`)) deleteCustomer(c.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit customer" : "Add customer"}>
        <CustomerForm
          initial={editing ?? undefined}
          onCancel={() => setModalOpen(false)}
          onSubmit={(values) => {
            if (editing) updateCustomer(editing.id, values);
            else addCustomer(values);
            setModalOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.name}'s purchase history` : ""}>
        {viewing ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{viewing.phone} · {viewing.address}</p>
            <DataTable
              rowKey={(s) => s.id}
              rows={viewingHistory}
              emptyMessage="No purchases yet."
              columns={[
                { header: "Invoice", render: (s) => s.invoiceNo },
                { header: "Date", render: (s) => formatDate(s.date) },
                { header: "Total", render: (s) => formatPKR(s.total) },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
