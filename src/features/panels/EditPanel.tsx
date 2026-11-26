import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { useConfirm } from "../../components/ConfirmDialog";
import { Drawer } from "../../components/Drawer";
import { useToast } from "../../components/Toast";
import { batch, create, newId, ops, update, type BatchOp } from "../../data/repo";
import { EMPTY, type CollectionName, type Draft, type Records } from "../../domain/records";
import { closeEdit, type Prefill } from "../../lib/route";
import { fromFormValues, toFormValues, type FieldDef, type FormValues } from "../shared/formModel";
import { RecordForm } from "../shared/RecordForm";

export interface PanelContext<C extends CollectionName> {
  record: Records[C] | null;
  values: FormValues;
}

type Deletion = { ops: BatchOp[]; body: string } | { blocked: string };

/**
 * Konfigurasi form satu koleksi. Dipakai PanelHost, jadi panel yang sama
 * terbuka dari daftar, dari detail klien, atau dari Hari ini.
 */
export interface FormConfig<C extends CollectionName> {
  collection: C;
  /** Kata benda huruf kecil: "klien", "proyek", ... */
  noun: string;
  fields: readonly FieldDef[];
  /** Isi otomatis antar-field, mis. harga dari jasa. */
  derive?: (key: string, next: FormValues, prev: FormValues) => FormValues;
  /** Nilai awal data baru. Prefill dari URL (clientId, projectId) ikut diterima. */
  initial?: (prefill: Prefill) => Partial<Draft<Records[C]>>;
  /** Diterapkan ke draft tepat sebelum disimpan, mis. cap tanggal deal. */
  prepare?: (draft: Draft<Records[C]>, record: Records[C] | null) => Draft<Records[C]>;
  /** Form kedua yang ikut disimpan saat menambah data baru (klien + proyek pertamanya). */
  companion?: Companion;
  /** Tombol di atas form, mis. Buka DM, Lihat klien. */
  extras?: (ctx: PanelContext<C>) => ReactNode;
  title: (record: Records[C]) => string;
  afterSave?: (id: string, draft: Draft<Records[C]>, before: Records[C] | null) => void;
  /** Setelah data baru dibuat (mis. pindah ke halaman klien). */
  afterCreate?: (id: string) => void;
  /** Bawaan: hapus dokumen ini saja. */
  deletion?: (record: Records[C]) => Deletion;
  /** Bawaan: tutup panel. */
  afterDelete?: () => void;
}

export interface Companion {
  title: string;
  config: FormConfig<"projects">;
  fields: readonly FieldDef[];
  /** Field yang diisi dari induk saat disimpan. */
  parentKey: "clientId";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function EditPanel<C extends CollectionName>({
  config,
  record,
  prefill = {},
}: {
  config: FormConfig<C>;
  record: Records[C] | null;
  prefill?: Prefill;
}) {
  const toast = useToast();
  const ask = useConfirm();

  const base = useMemo<Draft<Records[C]>>(() => {
    if (!record) return { ...EMPTY[config.collection], ...config.initial?.(prefill) } as Draft<Records[C]>;
    const { id: _id, ...rest } = record;
    return rest as unknown as Draft<Records[C]>;
    // prefill sengaja tidak jadi dependensi: hanya dibaca saat panel dibuka.
  }, [record, config]);

  const companion = record ? undefined : config.companion;
  const companionBase = useMemo<Draft<Records["projects"]>>(
    () => ({ ...EMPTY.projects, ...companion?.config.initial?.({}) }),
    [companion],
  );

  const asValues = (fields: readonly FieldDef[], r: unknown) => toFormValues(fields, r as Record<string, unknown>);
  const [values, setValues] = useState<FormValues>(() => asValues(config.fields, base));
  const [cValues, setCValues] = useState<FormValues>(() => (companion ? asValues(companion.fields, companionBase) : {}));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cErrors, setCErrors] = useState<Record<string, string>>({});

  // Dibandingkan dengan record terbaru (bukan nilai awal), jadi perubahan yang
  // langsung tersimpan (mis. dari tombol cepat) tidak dihitung belum disimpan.
  const dirty = useMemo(
    () =>
      JSON.stringify(values) !== JSON.stringify(asValues(config.fields, base)) ||
      (!!companion && JSON.stringify(cValues) !== JSON.stringify(asValues(companion.fields, companionBase))),
    [values, cValues, base, companionBase, config.fields, companion],
  );

  const change =
    (setter: typeof setValues, derive: FormConfig<C>["derive"], setErr: typeof setErrors, errs: Record<string, string>) =>
    (key: string, value: string) => {
      setter((prev) => {
        const next = { ...prev, [key]: value };
        return derive ? derive(key, next, prev) : next;
      });
      if (errs[key]) setErr(({ [key]: _, ...rest }) => rest);
    };
  const setValue = change(setValues, config.derive, setErrors, errors);
  const setCValue = change(setCValues, companion?.config.derive, setCErrors, cErrors);

  const failed = (e: unknown) => {
    console.error(e);
    toast("Gagal menyimpan. Periksa koneksi atau isian, lalu coba lagi.", "error");
  };

  const onSave = () => {
    const c = config.collection;
    const { draft: raw, errors: errs } = fromFormValues(c, config.fields, values, base);
    const draft = config.prepare ? config.prepare(raw, record) : raw;
    let child: { draft: Draft<Records["projects"]>; errors: Record<string, string> } | null = null;
    if (companion) {
      // clientId sementara supaya validasi lolos; diganti id klien baru di bawah.
      const r = fromFormValues("projects", companion.fields, cValues, { ...companionBase, [companion.parentKey]: "baru" });
      child = { draft: companion.config.prepare ? companion.config.prepare(r.draft, null) : r.draft, errors: r.errors };
    }
    setErrors(errs);
    setCErrors(child?.errors ?? {});
    if (Object.keys(errs).length || (child && Object.keys(child.errors).length)) return;

    if (record) {
      update(c, record.id, draft).catch(failed);
      closeEdit();
      toast("Perubahan disimpan.");
      config.afterSave?.(record.id, draft, record);
      return;
    }

    const id = newId(c);
    if (companion && child) {
      const childId = newId("projects");
      const childDraft = { ...child.draft, [companion.parentKey]: id };
      batch([ops.create(c, id, draft), ops.create("projects", childId, childDraft)]).catch(failed);
      companion.config.afterSave?.(childId, childDraft, null);
    } else {
      create(c, draft, id).promise.catch(failed);
    }
    toast(`${capitalize(config.noun)} ditambahkan.`);
    config.afterSave?.(id, draft, null);
    if (config.afterCreate) config.afterCreate(id);
    else closeEdit();
  };

  const askDelete = async () => {
    if (!record) return;
    const plan: Deletion = config.deletion?.(record) ?? {
      ops: [ops.delete(config.collection, record.id)],
      body: `"${config.title(record)}" akan dihapus permanen dan tidak bisa dikembalikan.`,
    };
    if ("blocked" in plan) {
      toast(plan.blocked, "error");
      return;
    }
    const ok = await ask({ title: `Hapus ${config.noun} ini?`, body: plan.body, confirmLabel: "Ya, hapus", tone: "danger" });
    if (!ok) return;
    batch(plan.ops).catch((e) => {
      console.error(e);
      toast("Gagal menghapus. Coba lagi.", "error");
    });
    if (config.afterDelete) config.afterDelete();
    else closeEdit();
    toast(`${capitalize(config.noun)} dihapus.`);
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

  const extras = config.extras?.({ record, values });
  const hasErrors = Object.keys(errors).length > 0 || Object.keys(cErrors).length > 0;

  return (
    <Drawer
      title={record ? config.title(record) : `Tambah ${config.noun}`}
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
        {companion && (
          <div className="mt-5 border-t border-gray-200 pt-5">
            <h3 className="mb-1 text-lg font-bold text-gray-900">{companion.title}</h3>
            <p className="mb-4 text-gray-500">Jasa yang ditanyakan dan langkah berikutnya. Bisa diubah nanti.</p>
            <RecordForm fields={companion.fields} values={cValues} errors={cErrors} onChange={setCValue} isNew />
          </div>
        )}
        {hasErrors && (
          <p role="alert" className="mt-5 text-late">
            Periksa isian yang ditandai.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
