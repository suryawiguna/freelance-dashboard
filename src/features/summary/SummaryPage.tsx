import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useData } from "../../data/DataContext";
import { COLLECTIONS, type CollectionName } from "../../domain/records";
import { formatDate, todayWita } from "../../lib/dates";
import { formatRupiah } from "../../lib/money";
import { navigate, openEdit, type RoutePath } from "../../lib/route";
import { summarize, WINDOW } from "../../lib/summary";

const PATH: Record<CollectionName, RoutePath> = {
  leads: "/lead",
  projects: "/proyek",
  payments: "/tagihan",
  assets: "/aset",
};

const KIND: Record<CollectionName, string> = {
  leads: "Lead",
  projects: "Proyek",
  payments: "Tagihan",
  assets: "Aset",
};

/** Semua angka dari lib/summary.ts (dites). Halaman ini hanya menampilkan. */
export default function SummaryPage() {
  const data = useData();
  const today = todayWita();
  const loaded = COLLECTIONS.every((c) => data.loaded[c]);
  const s = useMemo(
    () => summarize({ leads: data.leads, projects: data.projects, payments: data.payments, assets: data.assets }, today),
    [data.leads, data.projects, data.payments, data.assets, today],
  );

  if (!loaded) return <p className="py-12 text-center text-gray-500">Memuat...</p>;

  return (
    <>
      <PageHeader title="Ringkasan" actions={<p className="text-gray-600">{formatDate(today)}</p>} />

      <section aria-label="Angka utama" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Lead terbuka"
          value={String(s.openLeads.count)}
          detail={`Potensi setup ${formatRupiah(s.openLeads.setupTotal)}`}
          to="/lead"
        />
        <StatCard
          label="Pendapatan bulanan"
          value={formatRupiah(s.monthlyRevenue)}
          detail="Proyek Live dan Maintenance"
          to="/proyek"
        />
        <StatCard
          label="Belum dibayar"
          value={formatRupiah(s.unpaid.total)}
          detail={`${s.unpaid.count} tagihan`}
          to="/tagihan"
        />
        <StatCard
          label="Lunas bulan ini"
          value={formatRupiah(s.paidThisMonth.total)}
          detail={`${s.paidThisMonth.count} tagihan`}
          to="/tagihan"
        />
        <StatCard
          label="Perpanjangan dekat"
          value={String(s.renewalsSoon)}
          detail={`Aset dalam ${WINDOW.assetRenewal} hari`}
          to="/aset"
        />
      </section>

      <section aria-labelledby="tindak-lanjut" className="mt-10">
        <h2 id="tindak-lanjut" className="mb-4 text-lg font-bold">
          Perlu ditindaklanjuti
        </h2>
        {s.followUps.length === 0 ? (
          <EmptyState title="Semua aman">Tidak ada follow up, deadline, tagihan, atau perpanjangan yang dekat.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-card border border-gray-200 bg-surface">
            {s.followUps.map((f) => (
              <li key={`${f.collection}/${f.id}`}>
                <button
                  type="button"
                  onClick={() => openEdit(f.id, PATH[f.collection])}
                  className="flex min-h-11 w-full items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 focus-visible:bg-accent-soft focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={`h-10 w-1 shrink-0 rounded-full ${f.tone === "late" ? "bg-late" : "bg-near"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{f.title}</span>
                    <span className="block truncate text-gray-600">
                      {KIND[f.collection]}: {f.detail}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="hidden text-gray-600 sm:inline">{formatDate(f.date)}</span>
                    <Badge tone={f.tone}>{f.label}</Badge>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-gray-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, detail, to }: { label: string; value: string; detail: string; to: RoutePath }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      className="block rounded-card border border-gray-200 bg-surface p-5 transition-colors hover:border-gray-300"
    >
      <p className="text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-gray-500">{detail}</p>
    </a>
  );
}
