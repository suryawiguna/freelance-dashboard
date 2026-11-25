import { useMemo } from "react";
import { Badge } from "../../components/Chip";
import { DateCell } from "../../components/DateCell";
import { useData } from "../../data/DataContext";
import { PAYMENT_STATUSES, PAYMENT_TYPES, type Payment } from "../../domain/types";
import { formatDate, todayWita } from "../../lib/dates";
import { WINDOW } from "../../lib/summary";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import type { FieldDef, FormValues } from "../shared/formModel";
import { byDate, byText, CardLine, Money, Muted } from "../shared/helpers";

const unpaid = (p: Payment) => p.status !== "Lunas";

/** Belum lunas dulu (jatuh tempo terdekat), lalu yang lunas (terbaru dulu). */
function sortPayments(a: Payment, b: Payment): number {
  if (unpaid(a) !== unpaid(b)) return unpaid(a) ? -1 : 1;
  if (unpaid(a)) return byDate(a.due, b.due) || byText(a.client, b.client);
  return byDate(b.paidAt, a.paidAt) || byText(a.client, b.client);
}

function StatusBadge({ p }: { p: Payment }) {
  return p.status === "Lunas" ? <Badge tone="ok">Lunas</Badge> : <Badge tone="neutral">Belum</Badge>;
}

export default function PaymentsPage() {
  const { projects } = useData();
  const today = todayWita();

  const config = useMemo<PageConfig<"payments">>(() => {
    const fields: FieldDef[] = [
      {
        key: "projectId",
        label: "Proyek",
        kind: "select",
        nullable: true,
        hint: "Opsional. Klien terisi otomatis dari proyek.",
        options: [
          { value: "", label: "Tanpa proyek" },
          ...[...projects]
            .sort((a, b) => byText(a.client, b.client))
            .map((p) => ({ value: p.id, label: p.name ? `${p.client}: ${p.name}` : p.client })),
        ],
      },
      { key: "client", label: "Klien", kind: "text", required: true },
      { key: "item", label: "Item", kind: "text", placeholder: "No. invoice atau bulan", hint: "Contoh: INV-012, Langganan Des 2026" },
      { key: "type", label: "Jenis", kind: "select", options: PAYMENT_TYPES.map((s) => ({ value: s, label: s })) },
      { key: "amount", label: "Jumlah", kind: "money", required: true },
      { key: "due", label: "Jatuh tempo", kind: "date" },
      { key: "status", label: "Status", kind: "select", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: s })) },
      { key: "paidAt", label: "Tanggal dibayar", kind: "date", hint: "Terisi hari ini saat status diubah ke Lunas." },
    ];

    const derive = (key: string, next: FormValues): FormValues => {
      if (key === "projectId" && next.projectId && !next.client.trim()) {
        const p = projects.find((x) => x.id === next.projectId);
        if (p) return { ...next, client: p.client };
      }
      if (key === "status" && next.status === "Lunas" && !next.paidAt) return { ...next, paidAt: today };
      return next;
    };

    return {
      collection: "payments",
      title: "Tagihan",
      noun: "tagihan",
      csvName: "tagihan",
      fields,
      derive,
      filters: [
        {
          label: "Status",
          options: [
            { value: "semua", label: "Semua", test: () => true },
            ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s, test: (p: Payment) => p.status === s })),
          ],
        },
      ],
      searchText: (p) => `${p.client} ${p.item}`,
      sort: sortPayments,
      columns: [
        {
          header: "Klien",
          className: "min-w-40",
          cell: (p) => (
            <>
              <p className="font-semibold">{p.client}</p>
              <Muted>{p.item}</Muted>
            </>
          ),
        },
        { header: "Jenis", className: "hidden md:table-cell", cell: (p) => p.type },
        { header: "Jumlah", cell: (p) => <Money value={p.amount} /> },
        {
          header: "Jatuh tempo",
          cell: (p) => <DateCell date={p.due} today={today} nearDays={WINDOW.paymentDue} active={unpaid(p)} />,
        },
        {
          header: "Status",
          cell: (p) => (
            <>
              <StatusBadge p={p} />
              {p.status === "Lunas" && p.paidAt && <Muted>{formatDate(p.paidAt)}</Muted>}
            </>
          ),
        },
      ],
      card: (p) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{p.client}</p>
            <StatusBadge p={p} />
          </div>
          <Muted>{[p.type, p.item].filter(Boolean).join(", ")}</Muted>
          <CardLine label="Jumlah">
            <Money value={p.amount} />
          </CardLine>
          {p.due && (
            <CardLine label="Jatuh tempo">
              <DateCell date={p.due} today={today} nearDays={WINDOW.paymentDue} active={unpaid(p)} />
            </CardLine>
          )}
          {p.paidAt && <CardLine label="Dibayar">{formatDate(p.paidAt)}</CardLine>}
        </div>
      ),
      drawerTitle: (p) => (p.item ? `${p.client}, ${p.item}` : p.client),
      csv: [
        { header: "Klien", value: (p) => p.client },
        { header: "Item", value: (p) => p.item },
        { header: "Jenis", value: (p) => p.type },
        { header: "Jumlah", value: (p) => p.amount },
        { header: "Jatuh tempo", value: (p) => p.due },
        { header: "Status", value: (p) => p.status },
        { header: "Tanggal dibayar", value: (p) => p.paidAt },
        { header: "Proyek", value: (p) => projects.find((x) => x.id === p.projectId)?.name ?? p.projectId },
      ],
    };
  }, [projects, today]);

  return <CollectionPage config={config} />;
}
