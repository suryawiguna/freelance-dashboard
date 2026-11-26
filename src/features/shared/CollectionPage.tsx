import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { inputClass } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { Select } from "../../components/Select";
import { useData } from "../../data/DataContext";
import type { CollectionName, Records } from "../../domain/records";
import { cn } from "../../lib/cn";
import { toCsv, type CsvColumn } from "../../lib/csv";
import { todayWita } from "../../lib/dates";
import { downloadText } from "../../lib/download";
import { NEW_ID, openEdit, type Prefill } from "../../lib/route";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Kelas untuk th dan td, mis. "hidden lg:table-cell" atau "text-right". */
  className?: string;
}

export interface ChipFilter<T> {
  label: string;
  /**
   * "chips" (bawaan) untuk filter utama: tahap atau status, sebaiknya maksimal
   * lima pilihan (kelompokkan bila lebih). "select" untuk filter tambahan
   * (sumber, jenis), tampil sebagai dropdown di sebelah pencarian.
   */
  as?: "chips" | "select";
  /** Pilihan awal; bawaan pilihan pertama. */
  initial?: string;
  options: readonly { value: string; label: string; test: (row: T) => boolean }[];
}

/**
 * Daftar satu koleksi: filter, pencarian, tabel di desktop, kartu di HP,
 * ekspor CSV. Form edit tidak di sini, tetapi di PanelHost (features/panels),
 * jadi panel yang sama bisa dibuka dari halaman mana pun.
 */
export interface PageConfig<C extends CollectionName> {
  collection: C;
  title: string;
  /** Kata benda huruf kecil: "klien", "tagihan", ... */
  noun: string;
  csvName: string;
  /** Di bawah judul, mis. tab Tagihan/Aset. */
  intro?: ReactNode;
  /** Klik baris. Bawaan: buka panel edit. */
  open?: (row: Records[C]) => void;
  addPrefill?: Prefill;
  filters: ChipFilter<Records[C]>[];
  searchText: (row: Records[C]) => string;
  sort: (a: Records[C], b: Records[C]) => number;
  columns: Column<Records[C]>[];
  card: (row: Records[C]) => ReactNode;
  /** Tombol cepat di baris/kartu. Klik di sini tidak membuka panel. */
  /** compact = di tabel desktop: tombol ikon saja supaya tabel tidak melebar. */
  rowActions?: (row: Records[C], opts: { compact: boolean }) => ReactNode;
  csv: CsvColumn<Records[C]>[];
}

export function CollectionPage<C extends CollectionName>({ config }: { config: PageConfig<C> }) {
  const data = useData();
  const rows = data[config.collection] as Records[C][];
  const loaded = data.loaded[config.collection];
  const add = () => openEdit(config.collection, NEW_ID, config.addPrefill);

  const [chips, setChips] = useState<string[]>(() =>
    config.filters.map((f) => f.initial ?? f.options[0]?.value ?? ""),
  );
  const setFilter = (i: number, v: string) => setChips((c) => c.map((x, j) => (j === i ? v : x)));
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) =>
        config.filters.every((f, i) => (f.options.find((o) => o.value === chips[i]) ?? f.options[0]).test(r)),
      )
      .filter((r) => !q || config.searchText(r).toLowerCase().includes(q))
      .sort(config.sort);
  }, [rows, chips, query, config]);

  const exportCsv = () => {
    const sorted = [...rows].sort(config.sort);
    downloadText(`${config.csvName}-${todayWita()}.csv`, toCsv(sorted, config.csv));
  };

  return (
    <>
      <PageHeader
        title={config.title}
        actions={
          <div className="flex gap-2">
            <Button onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={20} aria-hidden />
              Ekspor CSV
            </Button>
            <Button variant="primary" onClick={add}>
              <Plus size={20} aria-hidden />
              Tambah
            </Button>
          </div>
        }
      />
      {config.intro}

      <div className="mb-6 space-y-3">
        {config.filters.map((f, i) =>
          f.as === "select" ? null : (
            <ChipGroup
              key={f.label}
              label={f.label}
              options={f.options.map((o) => ({ value: o.value, label: o.label, count: rows.filter(o.test).length }))}
              value={chips[i]}
              onChange={(v) => setFilter(i, v)}
            />
          ),
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block sm:w-80">
            <span className="sr-only">Cari nama</span>
            <Search size={20} className="pointer-events-none absolute left-3 top-3 text-gray-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama"
              className={cn(inputClass, "pl-10")}
            />
          </label>
          {config.filters.map((f, i) =>
            f.as === "select" ? (
              <div key={f.label} className="sm:w-60">
                <Select
                  aria-label={f.label}
                  value={chips[i]}
                  onChange={(v) => setFilter(i, v)}
                  options={f.options.map((o) => ({ value: o.value, label: `${o.label} (${rows.filter(o.test).length})` }))}
                />
              </div>
            ) : null,
          )}
        </div>
      </div>

      {!loaded ? (
        <p className="py-12 text-center text-gray-500">Memuat...</p>
      ) : rows.length === 0 ? (
        <EmptyState title={`Belum ada ${config.noun}`}>
          <Button variant="primary" className="mt-4" onClick={add}>
            Tambah {config.noun}
          </Button>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Tidak ada yang cocok">Ubah filter atau kata pencarian.</EmptyState>
      ) : (
        <DataList config={config} rows={visible} />
      )}
    </>
  );
}

/**
 * Tabel mulai 1024px, kartu di bawahnya. PLAN menyebut kartu di bawah 640px,
 * tetapi dengan sidebar 240px tabel tidak muat di 640 sampai 1023px tanpa
 * scroll horizontal, jadi kartu dipakai sampai 1024px. Klik baris membuka panel.
 */
function DataList<C extends CollectionName>({ config, rows }: { config: PageConfig<C>; rows: Records[C][] }) {
  const open = (row: Records[C]) => (config.open ? config.open(row) : openEdit(config.collection, row.id));
  const onKey = (e: React.KeyboardEvent, row: Records[C]) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open(row);
    }
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-gray-200 bg-surface lg:block">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              {config.columns.map((c) => (
                <th key={c.header} scope="col" className={cn("px-3 py-3 font-semibold", c.className)}>
                  {c.header}
                </th>
              ))}
              {config.rowActions && (
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">Aksi</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => open(r)}
                onKeyDown={(e) => onKey(e, r)}
                className="cursor-pointer border-b border-gray-100 align-top last:border-b-0 hover:bg-gray-50 focus-visible:bg-accent-soft focus-visible:outline-none"
              >
                {config.columns.map((c) => (
                  <td key={c.header} className={cn("break-words px-3 py-3", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
                {config.rowActions && (
                  <td className="px-3 py-2 text-right" onClick={stop} onKeyDown={stop}>
                    <div className="flex justify-end gap-1">{config.rowActions(r, { compact: true })}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            tabIndex={0}
            onClick={() => open(r)}
            onKeyDown={(e) => onKey(e, r)}
            className="cursor-pointer rounded-card border border-gray-200 bg-surface p-4 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {config.card(r)}
            {config.rowActions && (
              <div className="mt-3 flex flex-wrap gap-2" onClick={stop} onKeyDown={stop}>
                {config.rowActions(r, { compact: false })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
