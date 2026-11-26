import { CalendarPlus, Check, User } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../components/Button";
import { useData } from "../../data/DataContext";
import { useLookup } from "../../data/useLookup";
import { ops } from "../../data/repo";
import { quote } from "../../domain/pricing";
import { isDealt, needsNext, stampStage } from "../../domain/projectFlow";
import type { CollectionName } from "../../domain/records";
import {
  ASSET_KINDS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  SOURCES,
  STAGES,
  type Service,
  type Stage,
} from "../../domain/types";
import { isContact } from "../../domain/validate";
import { addDays, todayWita } from "../../lib/dates";
import { contactLabel, waLink } from "../../lib/contact";
import { formatRupiah, parseRupiah } from "../../lib/money";
import { clientPath, closeEditAndGo, replaceWith, usePage } from "../../lib/route";
import { moneyInput, splitMulti, type FieldDef, type FormValues } from "../shared/formModel";
import { LinkButton } from "../shared/helpers";
import { TemplateMenu } from "../shared/TemplateMenu";
import type { FormConfig } from "./EditPanel";
import { useActions } from "./useActions";

export type FormConfigs = { [C in CollectionName]: FormConfig<C> };

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

/** Teks harga untuk pilihan dan petunjuk: "Rp1.400.000 + Rp145.000/bln per cabang". */
export function servicePriceText(s: Service): string {
  const parts = [];
  if (s.setup !== null) parts.push(`${s.setupNote.startsWith("mulai") ? "mulai " : ""}${formatRupiah(s.setup)}`);
  if (s.monthly !== null) parts.push(`${formatRupiah(s.monthly)}/bln${s.unit ? ` per ${s.unit}` : ""}`);
  return parts.join(" + ");
}

const typedContact = (raw: string) => {
  const v = raw.trim();
  const mail = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(v) ? `mailto:${v}` : v;
  return mail && isContact(mail) ? mail : "";
};

/**
 * Konfigurasi form semua koleksi. Bergantung pada data (pilihan klien, jasa,
 * proyek), jadi dibuat ulang saat data berubah.
 */
export function useFormConfigs(): FormConfigs {
  const { services, projects, payments, assets } = useData();
  const lookup = useLookup();
  const actions = useActions();
  const page = usePage();

  return useMemo(() => {
    const today = todayWita();
    const serviceOf = (v: FormValues) => lookup.service(v.serviceId || null);
    const qtyOf = (v: FormValues) => (/^\d+$/.test((v.qty ?? "").trim()) ? Number(v.qty) : null);
    const quoteOf = (v: FormValues) => quote(serviceOf(v), splitMulti(v.extras ?? ""), qtyOf(v));
    const asInput = (n: number | null) => (n === null ? "" : moneyInput(n));

    // ---- Proyek ----

    const serviceOptions = (current: string) => [
      { value: "", label: "Tanpa jasa" },
      ...services
        .filter((s) => s.active || s.id === current)
        .sort((a, b) => a.name.localeCompare(b.name, "id"))
        .map((s) => ({ value: s.id, label: `${s.name}${servicePriceText(s) ? `, ${servicePriceText(s)}` : ""}` })),
    ];

    const patokan = (v: FormValues, key: "price" | "monthly") => {
      const q = quoteOf(v)[key];
      if (q === null) return undefined;
      const typed = parseRupiah(v[key] ?? "");
      const diff = typeof typed === "number" ? typed - q : 0;
      const note = key === "price" ? serviceOf(v)?.setupNote : "";
      return [`Patokan ${formatRupiah(q)}`, note, diff ? `selisih ${diff > 0 ? "+" : "-"}${formatRupiah(Math.abs(diff))}` : ""]
        .filter(Boolean)
        .join(", ");
    };

    const PRICE = "Harga";
    const priceFields: FieldDef[] = [
      {
        key: "serviceId",
        label: "Jasa",
        kind: "select",
        nullable: true,
        section: PRICE,
        dynamic: (v) => ({ options: serviceOptions(v.serviceId) }),
      },
      {
        key: "extras",
        label: "Tambahan",
        kind: "multi",
        section: PRICE,
        dynamic: (v) => {
          const s = serviceOf(v);
          if (!s?.extras.length) return { hidden: true };
          return { options: s.extras.map((x) => ({ value: x.name, label: `${x.name} +${formatRupiah(x.price)}` })) };
        },
      },
      {
        key: "qty",
        label: "Jumlah",
        kind: "count",
        section: PRICE,
        half: true,
        dynamic: (v) => {
          const unit = serviceOf(v)?.unit;
          return unit ? { label: `Jumlah ${unit}` } : { hidden: (v.qty ?? "") === "" };
        },
      },
      {
        key: "price",
        label: "Harga penawaran",
        kind: "money",
        section: PRICE,
        half: true,
        dynamic: (v) => ({ label: isDealt(v.stage as Stage) ? "Harga deal" : "Harga penawaran", hint: patokan(v, "price") }),
      },
      {
        key: "monthly",
        label: "Biaya bulanan",
        kind: "money",
        section: PRICE,
        half: true,
        dynamic: (v) => ({ hint: patokan(v, "monthly") }),
      },
    ];

    const FOLLOW = "Tindak lanjut";
    const followFields: FieldDef[] = [
      { key: "stage", label: "Tahap", kind: "choice", section: FOLLOW, options: opts(STAGES) },
      { key: "next", label: "Langkah berikutnya", kind: "text", section: FOLLOW, placeholder: "Follow up penawaran" },
      {
        key: "nextDate",
        label: "Tanggal berikutnya",
        kind: "date",
        section: FOLLOW,
        half: true,
        dynamic: (v) => (needsNext(v.stage as Stage) ? { required: true } : { hint: "Opsional untuk tahap ini." }),
      },
      { key: "due", label: "Deadline", kind: "date", section: FOLLOW, half: true },
    ];

    /** Harga dan biaya bulanan ikut jasa, tambahan, dan jumlah, selama belum diubah manual. */
    const deriveProject = (key: string, next: FormValues, prev: FormValues): FormValues => {
      if (!["serviceId", "extras", "qty"].includes(key)) return next;
      let out = next;
      if (key === "serviceId") {
        const s = serviceOf(next);
        const allowed = new Set(s?.extras.map((x) => x.name) ?? []);
        out = { ...out, extras: splitMulti(out.extras ?? "").filter((x) => allowed.has(x)).join("\n") };
      }
      const before = quoteOf(prev);
      const after = quoteOf(out);
      for (const k of ["price", "monthly"] as const) {
        const untouched = (prev[k] ?? "") === "" || prev[k] === asInput(before[k]);
        if (untouched) out = { ...out, [k]: asInput(after[k]) };
      }
      return out;
    };

    const projects_: FormConfig<"projects"> = {
      collection: "projects",
      noun: "proyek",
      fields: [
        ...followFields,
        ...priceFields,
        {
          key: "clientId",
          label: "Klien",
          kind: "select",
          required: true,
          section: "Proyek",
          options: lookup.clientOptions,
        },
        {
          key: "name",
          label: "Nama proyek",
          kind: "text",
          section: "Proyek",
          dynamic: (v) => ({ placeholder: serviceOf(v)?.name ?? "Contoh: Kasir 2 cabang", hint: "Kosong = nama jasa." }),
        },
        { key: "link", label: "Link proyek atau demo", kind: "url", section: "Proyek", placeholder: "https://" },
        { key: "note", label: "Catatan", kind: "textarea", section: "Proyek" },
      ],
      derive: deriveProject,
      initial: (prefill) => ({ clientId: prefill.clientId ?? "", nextDate: addDays(today, 1) }),
      prepare: (draft) => {
        const stamped = stampStage(draft, today);
        return { ...stamped, name: stamped.name || lookup.service(stamped.serviceId)?.name || "" };
      },
      afterSave: (id, draft, before) => {
        if (isDealt(draft.stage) && (!before || !isDealt(before.stage))) void actions.offerDealBills(id, draft);
      },
      extras: ({ record }) => {
        if (!record) return null;
        const onClientPage = page.name === "client" && page.id === record.clientId;
        return (
          <div className="flex flex-wrap gap-2">
            {!onClientPage && (
              <Button onClick={() => closeEditAndGo(clientPath(record.clientId))}>
                <User size={18} aria-hidden />
                Lihat klien
              </Button>
            )}
            {record.link && <LinkButton href={record.link}>Buka link</LinkButton>}
            <TemplateMenu link={record.link} />
          </div>
        );
      },
      title: (p) => `${lookup.projectName(p)}, ${lookup.clientName(p.clientId)}`,
      deletion: (p) => {
        const bills = payments.filter((x) => x.projectId === p.id);
        const linked = assets.filter((x) => x.projectId === p.id);
        return {
          ops: [
            ...bills.map((b) => ops.update("payments", b.id, { projectId: null })),
            ...linked.map((a) => ops.update("assets", a.id, { projectId: null })),
            ops.delete("projects", p.id),
          ],
          body: [
            `"${lookup.projectName(p)}" akan dihapus permanen.`,
            bills.length ? `${bills.length} tagihannya tetap disimpan di klien, tanpa proyek.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        };
      },
    };

    // ---- Klien ----

    const clients_: FormConfig<"clients"> = {
      collection: "clients",
      noun: "klien",
      fields: [
        { key: "name", label: "Nama", kind: "text", required: true, section: "Klien", placeholder: "Nama usaha atau orang" },
        {
          key: "source",
          label: "Sumber",
          kind: "select",
          section: "Klien",
          half: true,
          options: [{ value: "", label: "Belum diketahui" }, ...opts(SOURCES)],
        },
        {
          key: "sourceNote",
          label: "Detail sumber",
          kind: "text",
          section: "Klien",
          half: true,
          dynamic: (v) => ({ placeholder: v.source === "Referral" ? "Dari siapa" : "Postingan, iklan, dll" }),
        },
        {
          key: "contact",
          label: "Kontak",
          kind: "contact",
          section: "Klien",
          placeholder: "https://www.threads.com/messages/t/...",
          hint: "Link DM (diawali https://) atau alamat email.",
        },
        { key: "phone", label: "Nomor WA", kind: "phone", section: "Klien", half: true, placeholder: "0812 3456 7890" },
        { key: "note", label: "Catatan", kind: "textarea", section: "Klien", placeholder: "Jenis usaha, lokasi, cabang" },
      ],
      companion: {
        title: "Proyek pertama",
        config: projects_,
        parentKey: "clientId",
        fields: [...priceFields, ...followFields].map(({ section: _s, ...f }) => f),
      },
      extras: ({ record, values }) => {
        const contact = typedContact(values.contact ?? "");
        const wa = waLink(values.phone ?? "");
        if (!contact && !wa && !record) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {contact && <LinkButton href={contact}>{contactLabel(contact)}</LinkButton>}
            {wa && <LinkButton href={wa}>Chat WA</LinkButton>}
          </div>
        );
      },
      title: (c) => c.name,
      afterCreate: (id) => replaceWith(clientPath(id)),
      afterDelete: () => closeEditAndGo("/klien"),
      deletion: (c) => {
        const ps = projects.filter((p) => p.clientId === c.id);
        const bills = payments.filter((p) => p.clientId === c.id);
        const owned = assets.filter((a) => a.clientId === c.id);
        const counts = [
          ps.length && `${ps.length} proyek`,
          bills.length && `${bills.length} tagihan`,
          owned.length && `${owned.length} aset`,
        ].filter(Boolean);
        return {
          ops: [
            ...bills.map((b) => ops.delete("payments", b.id)),
            ...owned.map((a) => ops.delete("assets", a.id)),
            ...ps.map((p) => ops.delete("projects", p.id)),
            ops.delete("clients", c.id),
          ],
          body: `"${c.name}" akan dihapus permanen${counts.length ? `, bersama ${counts.join(", ")} miliknya` : ""}. Tidak bisa dikembalikan.`,
        };
      },
    };

    // ---- Tagihan ----

    const projectOptions = (clientId: string, emptyLabel: string) => [
      { value: "", label: emptyLabel },
      ...projects.filter((p) => p.clientId === clientId).map((p) => ({ value: p.id, label: lookup.projectName(p) })),
    ];

    const payments_: FormConfig<"payments"> = {
      collection: "payments",
      noun: "tagihan",
      fields: [
        { key: "status", label: "Status", kind: "choice", section: "Pembayaran", options: opts(PAYMENT_STATUSES) },
        { key: "due", label: "Jatuh tempo", kind: "date", section: "Pembayaran", half: true },
        { key: "paidAt", label: "Tanggal dibayar", kind: "date", section: "Pembayaran", half: true, hint: "Terisi hari ini saat Lunas." },
        { key: "clientId", label: "Klien", kind: "select", required: true, section: "Tagihan", options: lookup.clientOptions },
        {
          key: "projectId",
          label: "Proyek",
          kind: "select",
          nullable: true,
          section: "Tagihan",
          dynamic: (v) => (v.clientId ? { options: projectOptions(v.clientId, "Tanpa proyek") } : { hidden: true }),
        },
        { key: "amount", label: "Jumlah", kind: "money", required: true, section: "Tagihan", half: true },
        { key: "type", label: "Jenis", kind: "select", section: "Tagihan", half: true, options: opts(PAYMENT_TYPES) },
        { key: "item", label: "Item", kind: "text", section: "Tagihan", placeholder: "No. invoice atau bulan", hint: "Contoh: INV-012" },
        {
          key: "period",
          label: "Bulan langganan",
          kind: "text",
          section: "Tagihan",
          placeholder: "2026-12",
          dynamic: (v) => ({ hidden: v.type !== "Langganan" && !v.period }),
        },
      ],
      derive: (key, next) => {
        if (key === "clientId" && next.projectId && lookup.project(next.projectId)?.clientId !== next.clientId) {
          return { ...next, projectId: "" };
        }
        if (key === "status" && next.status === "Lunas" && !next.paidAt) return { ...next, paidAt: today };
        if (key === "status" && next.status === "Belum") return { ...next, paidAt: "" };
        return next;
      },
      initial: (prefill) => {
        const p = lookup.project(prefill.projectId ?? null);
        return { clientId: p?.clientId ?? prefill.clientId ?? "", projectId: p?.id ?? null, due: today };
      },
      title: (p) => [lookup.clientName(p.clientId), p.item || p.type].join(", "),
    };

    // ---- Aset ----

    const assets_: FormConfig<"assets"> = {
      collection: "assets",
      noun: "aset",
      fields: [
        { key: "renewal", label: "Tanggal perpanjangan", kind: "date", section: "Perpanjangan", half: true },
        { key: "cost", label: "Biaya per tahun", kind: "money", section: "Perpanjangan", half: true },
        { key: "item", label: "Item", kind: "text", required: true, section: "Aset", placeholder: "contoh.com, nama project Firebase" },
        { key: "kind", label: "Jenis", kind: "choice", section: "Aset", options: opts(ASSET_KINDS) },
        {
          key: "clientId",
          label: "Klien",
          kind: "select",
          nullable: true,
          section: "Aset",
          half: true,
          options: [{ value: "", label: "Milik sendiri" }, ...lookup.clientOptions],
        },
        {
          key: "projectId",
          label: "Proyek",
          kind: "select",
          nullable: true,
          section: "Aset",
          half: true,
          dynamic: (v) => (v.clientId ? { options: projectOptions(v.clientId, "Semua proyek") } : { hidden: true }),
        },
        { key: "provider", label: "Provider", kind: "text", section: "Aset" },
        { key: "note", label: "Catatan", kind: "textarea", section: "Aset" },
      ],
      derive: (key, next) =>
        key === "clientId" && next.projectId && lookup.project(next.projectId)?.clientId !== next.clientId
          ? { ...next, projectId: "" }
          : next,
      initial: (prefill) => ({ clientId: prefill.clientId ?? null, projectId: prefill.projectId ?? null }),
      extras: ({ record }) =>
        record?.renewal ? (
          <Button onClick={() => actions.renewed(record)}>
            <CalendarPlus size={18} aria-hidden />
            Sudah diperpanjang, +1 tahun
          </Button>
        ) : null,
      title: (a) => a.item,
    };

    // ---- Jasa ----

    const services_: FormConfig<"services"> = {
      collection: "services",
      noun: "jasa",
      fields: [
        { key: "name", label: "Nama jasa", kind: "text", required: true, section: "Harga patokan", placeholder: "Kasir, Website" },
        { key: "setup", label: "Harga setup atau proyek", kind: "money", section: "Harga patokan", half: true },
        { key: "setupNote", label: "Keterangan harga", kind: "text", section: "Harga patokan", half: true, placeholder: "mulai dari" },
        { key: "monthly", label: "Biaya bulanan", kind: "money", section: "Harga patokan", half: true },
        {
          key: "unit",
          label: "Per satuan",
          kind: "text",
          section: "Harga patokan",
          half: true,
          placeholder: "cabang",
          hint: "Biaya bulanan dikali jumlah ini. Kosong = tidak dikali.",
        },
        {
          key: "extras",
          label: "Tambahan opsional",
          kind: "pricelist",
          section: "Harga patokan",
          placeholder: "Booking via WhatsApp: 300.000",
          hint: "Satu per baris: nama, titik dua, harga.",
        },
        {
          key: "dpPercent",
          label: "DP saat deal (%)",
          kind: "count",
          section: "Pembayaran",
          half: true,
          hint: "100 = bayar penuh di depan, 0 = tanpa DP.",
        },
        {
          key: "active",
          label: "Ditawarkan",
          kind: "toggle",
          section: "Pembayaran",
          half: true,
          hint: "Tidak = disembunyikan dari pilihan jasa.",
        },
        { key: "includes", label: "Isi paket", kind: "textarea", section: "Isi paket", placeholder: "Yang termasuk, untuk bahan penawaran" },
      ],
      title: (s) => s.name,
      deletion: (s) => {
        const used = projects.filter((p) => p.serviceId === s.id).length;
        if (used) return { blocked: `Jasa ini dipakai ${used} proyek. Ubah "Ditawarkan" jadi Tidak untuk menyembunyikannya.` };
        return { ops: [ops.delete("services", s.id)], body: `"${s.name}" akan dihapus permanen.` };
      },
    };

    return { services: services_, clients: clients_, projects: projects_, payments: payments_, assets: assets_ };
  }, [services, projects, payments, assets, lookup, actions, page]);
}

/** Tombol kecil "Lunas hari ini", dipakai di beberapa daftar. */
export function PaidButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <Button onClick={onClick} title="Lunas hari ini" aria-label="Tandai lunas hari ini" icon={compact}>
      <Check size={18} aria-hidden />
      {!compact && "Lunas hari ini"}
    </Button>
  );
}

