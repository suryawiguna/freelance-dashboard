import { ReceiptText } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "../../components/Chip";
import { Button } from "../../components/Button";
import { DateCell } from "../../components/DateCell";
import { useData } from "../../data/DataContext";
import { useLookup } from "../../data/useLookup";
import { pendingMonthlyBills } from "../../domain/billing";
import { ASSET_KINDS, PAYMENT_STATUSES, type Asset, type Payment } from "../../domain/types";
import { cn } from "../../lib/cn";
import { formatDate, formatMonth, monthOf, todayWita } from "../../lib/dates";
import { formatRupiah } from "../../lib/money";
import { clientPath, onNavClick } from "../../lib/route";
import { WINDOW } from "../../lib/summary";
import { PaidButton } from "../panels/forms";
import { useActions } from "../panels/useActions";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import { byDate, byText, CardLine, Money, Muted } from "../shared/helpers";

type Tab = "bills" | "assets";

const TABS: { tab: Tab; path: string; label: string }[] = [
  { tab: "bills", path: "/uang", label: "Tagihan" },
  { tab: "assets", path: "/uang/aset", label: "Aset" },
];

/** Uang (PLAN-KLIEN §4.4): tagihan dan aset (biaya perpanjangan), dua tab dengan URL sendiri. */
export default function MoneyPage({ tab }: { tab: Tab }) {
  const intro = (
    <nav aria-label="Bagian" className="-mt-4 mb-6 flex gap-2">
      {TABS.map((t) => (
        <a
          key={t.tab}
          href={t.path}
          onClick={onNavClick(t.path)}
          aria-current={t.tab === tab ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4",
            t.tab === tab ? "border-accent bg-accent-soft font-semibold text-accent" : "border-gray-200 bg-surface text-gray-700 hover:bg-gray-50",
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
  return tab === "bills" ? <Bills intro={intro} /> : <Assets intro={intro} />;
}

const unpaid = (p: Payment) => p.status !== "Lunas";

/** Belum lunas dulu (jatuh tempo terdekat), lalu yang lunas (terbaru dulu). */
function sortPayments(a: Payment, b: Payment, name: (p: Payment) => string): number {
  if (unpaid(a) !== unpaid(b)) return unpaid(a) ? -1 : 1;
  if (unpaid(a)) return byDate(a.due, b.due) || byText(name(a), name(b));
  return byDate(b.paidAt, a.paidAt) || byText(name(a), name(b));
}

function ClientLink({ id, name }: { id: string | null; name: string }) {
  if (!id) return <span className="font-semibold">{name}</span>;
  return (
    <a href={clientPath(id)} onClick={(e) => { e.stopPropagation(); onNavClick(clientPath(id))(e); }} className="font-semibold hover:underline">
      {name}
    </a>
  );
}

function Bills({ intro }: { intro: React.ReactNode }) {
  const { projects, payments } = useData();
  const lookup = useLookup();
  const actions = useActions();
  const today = todayWita();
  const month = monthOf(today);
  const pending = useMemo(() => pendingMonthlyBills(projects, payments, month), [projects, payments, month]);

  const config = useMemo<PageConfig<"payments">>(() => {
    const name = (p: Payment) => lookup.clientName(p.clientId);
    const what = (p: Payment) => {
      const project = lookup.project(p.projectId);
      return [p.type, p.item, project ? lookup.projectName(project) : ""].filter(Boolean).join(", ");
    };
    const Status = ({ p }: { p: Payment }) =>
      p.status === "Lunas" ? (
        <Badge tone="ok">Lunas{p.paidAt ? ` ${formatDate(p.paidAt)}` : ""}</Badge>
      ) : (
        <DateCell date={p.due} today={today} nearDays={WINDOW.payment} />
      );

    return {
      collection: "payments",
      title: "Uang",
      noun: "tagihan",
      csvName: "tagihan",
      intro: (
        <>
          {intro}
          {pending.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-near/30 bg-near-soft px-4 py-3">
              <p>
                Tagihan langganan {formatMonth(month)} belum dibuat untuk {pending.length} proyek, total{" "}
                {formatRupiah(pending.reduce((a, b) => a + b.draft.amount, 0))}.
              </p>
              <Button variant="primary" onClick={() => actions.createMonthly(pending)}>
                <ReceiptText size={18} aria-hidden />
                Buat tagihan
              </Button>
            </div>
          )}
        </>
      ),
      filters: [
        {
          label: "Status",
          initial: "Belum",
          options: [
            ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s, test: (p: Payment) => p.status === s })),
            { value: "semua", label: "Semua", test: () => true },
          ],
        },
      ],
      searchText: (p) => `${name(p)} ${what(p)}`,
      sort: (a, b) => sortPayments(a, b, name),
      columns: [
        {
          header: "Klien",
          className: "min-w-40",
          cell: (p) => (
            <>
              <ClientLink id={p.clientId} name={name(p)} />
              <Muted>{what(p)}</Muted>
            </>
          ),
        },
        { header: "Jumlah", cell: (p) => <Money value={p.amount} /> },
        { header: "Jatuh tempo", cell: (p) => <Status p={p} /> },
      ],
      card: (p) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <ClientLink id={p.clientId} name={name(p)} />
            <Money value={p.amount} />
          </div>
          <Muted>{what(p)}</Muted>
          <CardLine label={p.status === "Lunas" ? "Status" : "Jatuh tempo"}>
            <Status p={p} />
          </CardLine>
        </div>
      ),
      rowActions: (p, { compact }) => (unpaid(p) ? <PaidButton compact={compact} onClick={() => actions.markPaid(p)} /> : null),
      csv: [
        { header: "Klien", value: (p) => name(p) },
        { header: "Proyek", value: (p) => (p.projectId ? lookup.projectName(lookup.project(p.projectId)) : "") },
        { header: "Jenis", value: (p) => p.type },
        { header: "Item", value: (p) => p.item },
        { header: "Bulan langganan", value: (p) => p.period },
        { header: "Jumlah", value: (p) => p.amount },
        { header: "Jatuh tempo", value: (p) => p.due },
        { header: "Status", value: (p) => p.status },
        { header: "Tanggal dibayar", value: (p) => p.paidAt },
      ],
    };
  }, [lookup, actions, today, month, pending, intro]);

  return <CollectionPage config={config} />;
}

function Assets({ intro }: { intro: React.ReactNode }) {
  const lookup = useLookup();
  const today = todayWita();

  const config = useMemo<PageConfig<"assets">>(() => {
    const owner = (a: Asset) => lookup.clientName(a.clientId);
    return {
      collection: "assets",
      title: "Uang",
      noun: "aset",
      csvName: "aset",
      intro,
      filters: [
        {
          label: "Jenis",
          as: "select",
          options: [
            { value: "semua", label: "Semua jenis", test: () => true },
            ...ASSET_KINDS.map((s) => ({ value: s, label: s, test: (a: Asset) => a.kind === s })),
          ],
        },
      ],
      searchText: (a) => `${a.item} ${owner(a)} ${a.provider}`,
      sort: (a, b) => byDate(a.renewal, b.renewal) || byText(a.item, b.item),
      columns: [
        {
          header: "Item",
          className: "min-w-40",
          cell: (a) => (
            <>
              <p className="break-all font-semibold">{a.item}</p>
              <Muted>
                <ClientLink id={a.clientId} name={owner(a)} />
              </Muted>
            </>
          ),
        },
        { header: "Jenis", cell: (a) => a.kind },
        { header: "Provider", className: "hidden xl:table-cell", cell: (a) => a.provider || <Muted>-</Muted> },
        { header: "Biaya per tahun", cell: (a) => <Money value={a.cost} /> },
        { header: "Perpanjangan", cell: (a) => <DateCell date={a.renewal} today={today} nearDays={WINDOW.renewal} /> },
      ],
      card: (a) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="break-all font-semibold">{a.item}</p>
            <span className="shrink-0 text-gray-600">{a.kind}</span>
          </div>
          <Muted>
            <ClientLink id={a.clientId} name={owner(a)} />
          </Muted>
          {a.cost !== null && (
            <CardLine label="Biaya">
              <Money value={a.cost} suffix="/thn" />
            </CardLine>
          )}
          {a.renewal && (
            <CardLine label="Perpanjangan">
              <DateCell date={a.renewal} today={today} nearDays={WINDOW.renewal} />
            </CardLine>
          )}
        </div>
      ),
      csv: [
        { header: "Item", value: (a) => a.item },
        { header: "Klien", value: (a) => owner(a) },
        { header: "Jenis", value: (a) => a.kind },
        { header: "Provider", value: (a) => a.provider },
        { header: "Biaya per tahun", value: (a) => a.cost },
        { header: "Perpanjangan", value: (a) => a.renewal },
        { header: "Catatan", value: (a) => a.note },
      ],
    };
  }, [lookup, today, intro]);

  return <CollectionPage config={config} />;
}
