import { CalendarPlus, ChevronRight, MessageSquarePlus, ReceiptText } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Badge } from "../../components/Chip";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useAllLoaded, useData } from "../../data/DataContext";
import { useLookup } from "../../data/useLookup";
import { contactLabel } from "../../lib/contact";
import { formatDate, formatMonth, todayWita } from "../../lib/dates";
import { formatRupiah } from "../../lib/money";
import { clientPath, navigate, onNavClick, openEdit } from "../../lib/route";
import { GROUPS, summarize, WINDOW, type Group, type TodayItem } from "../../lib/summary";
import { PaidButton } from "../panels/forms";
import { useActions } from "../panels/useActions";
import { LinkButton } from "../shared/helpers";

const GROUP_TITLE: Record<Group, string> = {
  contact: "Hubungi",
  work: "Kerjakan",
  payment: "Tagih",
  renewal: "Perpanjang",
};
const GROUP_EMPTY: Record<Group, string> = {
  contact: `Tidak ada follow up dalam ${WINDOW.contact} hari.`,
  work: `Tidak ada deadline atau langkah dalam ${WINDOW.work} hari.`,
  payment: `Tidak ada tagihan jatuh tempo dalam ${WINDOW.payment} hari.`,
  renewal: `Tidak ada perpanjangan dalam ${WINDOW.renewal} hari.`,
};

/**
 * Halaman utama (PLAN-KLIEN §4.1): siapa yang dihubungi, apa yang dikerjakan,
 * siapa yang ditagih, apa yang diperpanjang. Angka dari lib/summary.ts (dites).
 */
export default function TodayPage() {
  const data = useData();
  const loaded = useAllLoaded();
  const actions = useActions();
  const today = todayWita();
  const s = useMemo(
    () => summarize({ clients: data.clients, projects: data.projects, payments: data.payments, assets: data.assets }, today),
    [data.clients, data.projects, data.payments, data.assets, today],
  );

  if (!loaded) return <p className="py-12 text-center text-gray-500">Memuat...</p>;
  const total = GROUPS.reduce((a, g) => a + s.groups[g].length, 0);
  const bills = s.pendingBills.bills;

  return (
    <>
      <PageHeader title="Hari ini" actions={<p className="text-gray-600">{formatDate(today)}</p>} />

      {bills.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-near/30 bg-near-soft px-4 py-3">
          <p>
            Tagihan langganan {formatMonth(s.pendingBills.month)} belum dibuat untuk {bills.length} proyek, total{" "}
            {formatRupiah(bills.reduce((a, b) => a + b.draft.amount, 0))}.
          </p>
          <Button variant="primary" onClick={() => actions.createMonthly(bills)}>
            <ReceiptText size={18} aria-hidden />
            Buat tagihan
          </Button>
        </div>
      )}

      {total === 0 ? (
        <EmptyState title="Semua aman">Tidak ada follow up, pekerjaan, tagihan, atau perpanjangan yang dekat.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          {GROUPS.filter((g) => g !== "renewal" || s.groups.renewal.length > 0).map((g) => (
            <section key={g} aria-labelledby={`grup-${g}`}>
              <h2 id={`grup-${g}`} className="mb-3 flex items-center gap-2 text-lg font-bold">
                {GROUP_TITLE[g]}
                <span className="font-normal text-gray-500">{s.groups[g].length}</span>
              </h2>
              {s.groups[g].length === 0 ? (
                <p className="rounded-card border border-dashed border-gray-200 px-4 py-4 text-gray-500">{GROUP_EMPTY[g]}</p>
              ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-card border border-gray-200 bg-surface">
                  {s.groups[g].map((item) => (
                    <Row key={`${item.collection}/${item.id}`} item={item} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <section aria-label="Angka utama" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan bulanan"
          value={formatRupiah(s.monthlyRevenue.total)}
          detail={`${s.monthlyRevenue.count} proyek live`}
          to="/klien"
        />
        <StatCard label="Belum dibayar" value={formatRupiah(s.unpaid.total)} detail={`${s.unpaid.count} tagihan`} to="/uang" />
        <StatCard
          label="Lunas bulan ini"
          value={formatRupiah(s.paidThisMonth.total)}
          detail={`${s.paidThisMonth.count} tagihan`}
          to="/uang"
        />
        <StatCard
          label="Potensi prospek"
          value={formatRupiah(s.prospects.total)}
          detail={`${s.prospects.count} proyek masih dikejar`}
          to="/klien"
        />
      </section>
    </>
  );
}

function Row({ item }: { item: TodayItem }) {
  const data = useData();
  const lookup = useLookup();
  const actions = useActions();

  const open = () => {
    if (item.collection === "projects" && item.clientId) navigate(clientPath(item.clientId));
    else openEdit(item.collection, item.id);
  };

  let buttons: ReactNode = null;
  if (item.collection === "projects" && item.group === "contact") {
    const p = lookup.project(item.id);
    const contact = lookup.client(item.clientId)?.contact;
    buttons = p && (
      <>
        {contact && (
          <LinkButton href={contact} iconOnly>
            {contactLabel(contact)}
          </LinkButton>
        )}
        <Button onClick={() => actions.contacted(p)} title="Sudah dihubungi, geser 3 hari" aria-label={`Sudah dihubungi ${item.title}`} icon>
          <MessageSquarePlus size={18} aria-hidden />
        </Button>
      </>
    );
  } else if (item.collection === "payments") {
    const p = data.payments.find((x) => x.id === item.id);
    buttons = p && <PaidButton compact onClick={() => actions.markPaid(p)} />;
  } else if (item.collection === "assets") {
    const a = data.assets.find((x) => x.id === item.id);
    buttons = a && (
      <Button onClick={() => actions.renewed(a)} title="Sudah diperpanjang, +1 tahun" aria-label={`Sudah diperpanjang ${item.title}`} icon>
        <CalendarPlus size={18} aria-hidden />
      </Button>
    );
  }

  return (
    <li className="flex items-center gap-2 pr-2 hover:bg-gray-50">
      <button
        type="button"
        onClick={open}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-4 py-3 pl-4 text-left focus-visible:bg-accent-soft focus-visible:outline-none"
      >
        <span aria-hidden className={`h-10 w-1 shrink-0 rounded-full ${item.tone === "late" ? "bg-late" : "bg-near"}`} />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold sm:truncate">{item.title}</span>
          <span className="block truncate text-gray-600">{item.detail}</span>
          {/* Di HP label di bawah judul supaya nama tidak terpotong. */}
          <span className="mt-1 block sm:hidden">
            <Badge tone={item.tone}>{item.label}</Badge>
          </span>
        </span>
        <span className="hidden sm:inline-flex">
          <Badge tone={item.tone}>{item.label}</Badge>
        </span>
        <ChevronRight size={20} className="hidden shrink-0 text-gray-400 sm:block" aria-hidden />
      </button>
      {buttons && <div className="flex shrink-0 gap-1">{buttons}</div>}
    </li>
  );
}

function StatCard({ label, value, detail, to }: { label: string; value: string; detail: string; to: string }) {
  return (
    <a href={to} onClick={onNavClick(to)} className="block rounded-card border border-gray-200 bg-surface p-5 transition-colors hover:border-gray-300">
      <p className="text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-gray-500">{detail}</p>
    </a>
  );
}
