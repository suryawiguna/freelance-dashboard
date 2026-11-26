import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { useConfirm } from "../../components/ConfirmDialog";
import { ChipGroup } from "../../components/Chip";
import { Drawer } from "../../components/Drawer";
import { EmptyState } from "../../components/EmptyState";
import { inputClass } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { Select } from "../../components/Select";
import { useToast } from "../../components/Toast";
import { useData } from "../../data/DataContext";
import { create, remove, update } from "../../data/repo";
import { EMPTY, type CollectionName, type Draft, type Records } from "../../domain/records";
import { cn } from "../../lib/cn";
import { toCsv, type CsvColumn } from "../../lib/csv";
import { todayWita } from "../../lib/dates";
import { downloadText } from "../../lib/download";
import { closeEdit, NEW_ID, openEdit, useEditId } from "../../lib/route";
import { fromFormValues, toFormValues, type FieldDef, type FormValues } from "./formModel";
import { RecordForm } from "./RecordForm";

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

export interface PanelContext<T> {
  record: T | null;
  values: FormValues;
  setValue: (key: string, value: string) => void;
  /** Validasi + simpan form sekarang; hasilnya id dan draft, atau null bila tidak valid. */
  saveNow: () => { id: string; draft: Draft<T> } | null;
}

export interface PageConfig<C extends CollectionName> {
  collection: C;
  title: string;
  /** Kata benda huruf kecil: "lead", "proyek", ... */
  noun: string;
  csvName: string;
  fields: readonly FieldDef[];
  /** Isi otomatis antar-field, mis. biaya bulanan dari jumlah cabang. */
  derive?: (key: string, next: FormValues, prev: FormValues) => FormValues;
  filters: ChipFilter<Records[C]>[];
  searchText: (row: Records[C]) => string;
  sort: (a: Records[C], b: Records[C]) => number;
  columns: Column<Records[C]>[];
  card: (row: Records[C]) => ReactNode;
  /** Tombol cepat di baris/kartu. Klik di sini tidak membuka panel. */
  /** compact = di tabel desktop: tombol ikon saja supaya tabel tidak melebar. */
  rowActions?: (row: Records[C], opts: { compact: boolean }) => ReactNode;
  panelExtras?: (ctx: PanelContext<Records[C]>) => ReactNode;
  drawerTitle: (row: Records[C]) => string;
  csv: CsvColumn<Records[C]>[];
}

export function CollectionPage<C extends CollectionName>({ config }: { config: PageConfig<C> }) {
  const data = useData();
  const rows = data[config.collection] as Records[C][];
  const loaded = data.loaded[config.collection];
  const editId = useEditId();

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

  const editing = editId === null ? undefined : editId === NEW_ID ? null : rows.find((r) => r.id === editId);

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
            <Button variant="primary" onClick={() => openEdit(NEW_ID)}>
              <Plus size={20} aria-hidden />
              Tambah
            </Button>
          </div>
        }
      />

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
          <Button variant="primary" className="mt-4" onClick={() => openEdit(NEW_ID)}>
            Tambah {config.noun}
          </Button>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Tidak ada yang cocok">Ubah filter atau kata pencarian.</EmptyState>
      ) : (
        <DataList config={config} rows={visible} />
      )}

      {editing !== undefined && (
        <EditPanel key={editId} config={config} record={editing} />
      )}
      {editId !== null && editId !== NEW_ID && editing === undefined && loaded && (
        <Drawer title="Tidak ditemukan" onClose={closeEdit}>
          <p className="text-gray-600">Data ini sudah dihapus atau tautannya salah.</p>
        </Drawer>
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
  const open = (id: string) => openEdit(id);
  const onKey = (e: React.KeyboardEvent, id: string) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open(id);
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
                onClick={() => open(r.id)}
                onKeyDown={(e) => onKey(e, r.id)}
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
            onClick={() => open(r.id)}
            onKeyDown={(e) => onKey(e, r.id)}
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

function EditPanel<C extends CollectionName>({ config, record }: { config: PageConfig<C>; record: Records[C] | null }) {
  const toast = useToast();
  const base = useMemo<Draft<Records[C]>>(() => {
    if (!record) return EMPTY[config.collection];
    const { id: _id, ...rest } = record;
    return rest as unknown as Draft<Records[C]>;
  }, [record, config.collection]);

  const [values, setValues] = useState<FormValues>(() =>
    toFormValues(config.fields, base as unknown as Record<string, unknown>),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ask = useConfirm();

  // Dibandingkan dengan record terbaru (bukan nilai awal), jadi perubahan yang
  // langsung tersimpan (Follow up +3 hari) tidak dihitung belum disimpan.
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(toFormValues(config.fields, base as unknown as Record<string, unknown>)),
    [values, base, config.fields],
  );

  const setValue = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      return config.derive ? config.derive(key, next, prev) : next;
    });
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const failed = (e: unknown) => {
    console.error(e);
    toast("Gagal menyimpan. Periksa koneksi atau isian, lalu coba lagi.", "error");
  };

  const saveNow = () => {
    const { draft, errors: errs } = fromFormValues(config.collection, config.fields, values, base);
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    if (record) {
      update(config.collection, record.id, draft).catch(failed);
      return { id: record.id, draft };
    }
    const { id, promise } = create(config.collection, draft);
    promise.catch(failed);
    return { id, draft };
  };

  const onSave = () => {
    if (saveNow()) {
      closeEdit();
      toast(record ? "Perubahan disimpan." : `${capitalize(config.noun)} ditambahkan.`);
    }
  };

  const onDelete = () => {
    if (!record) return;
    remove(config.collection, record.id).catch((e) => {
      console.error(e);
      toast("Gagal menghapus. Coba lagi.", "error");
    });
    closeEdit();
    toast(`${capitalize(config.noun)} dihapus.`);
  };

  const askDelete = async () => {
    if (!record) return;
    const ok = await ask({
      title: `Hapus ${config.noun} ini?`,
      body: `"${config.drawerTitle(record)}" akan dihapus permanen dan tidak bisa dikembalikan.`,
      confirmLabel: "Ya, hapus",
      tone: "danger",
    });
    if (ok) onDelete();
  };

  /** X, Escape, klik latar, atau Batal: tanya dulu bila ada perubahan yang belum disimpan. */
  const requestClose = async () => {
    if (dirty) {
      const ok = await ask({
        title: "Buang perubahan?",
        body: "Perubahan yang belum disimpan akan hilang.",
        confirmLabel: "Buang",
        tone: "danger",
      });
      if (!ok) return;
    }
    closeEdit();
  };

  const footer = (
    <div className="flex items-center gap-2">
      {record && (
        <Button variant="ghost" className="text-late" onClick={() => void askDelete()}>
          Hapus
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        <Button onClick={() => void requestClose()}>Batal</Button>
        <Button variant="primary" onClick={onSave}>
          Simpan
        </Button>
      </div>
    </div>
  );

  const extras = config.panelExtras?.({ record, values, setValue, saveNow });

  return (
    <Drawer
      title={record ? config.drawerTitle(record) : `Tambah ${config.noun}`}
      onClose={() => void requestClose()}
      footer={footer}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {extras && <div className="mb-6">{extras}</div>}
        <RecordForm fields={config.fields} values={values} errors={errors} onChange={setValue} isNew={!record} />
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-5 text-late">
            Periksa isian yang ditandai.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
