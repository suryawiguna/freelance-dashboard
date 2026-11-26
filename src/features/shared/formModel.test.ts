import { describe, expect, it } from "vitest";
import { EMPTY } from "../../domain/records";
import { formSections, fromFormValues, parsePriceList, resolveField, toFormValues, type FieldDef } from "./formModel";

const PROJECT_FIELDS: FieldDef[] = [
  { key: "clientId", label: "Klien", kind: "select" },
  { key: "price", label: "Harga", kind: "money" },
  { key: "qty", label: "Cabang", kind: "count" },
  { key: "link", label: "Link", kind: "url" },
  { key: "nextDate", label: "Berikutnya", kind: "date" },
];

describe("toFormValues", () => {
  it("uang dengan titik ribuan, null jadi kosong", () => {
    const v = toFormValues(PROJECT_FIELDS, { ...EMPTY.projects, clientId: "c", price: 1_400_000, qty: 2 });
    expect(v).toEqual({ clientId: "c", price: "1.400.000", qty: "2", link: "", nextDate: "" });
  });
  it("jumlah tagihan 0 (baru) tampil kosong", () => {
    expect(toFormValues([{ key: "amount", label: "Jumlah", kind: "money" }], EMPTY.payments)).toEqual({ amount: "" });
  });
  it("daftar: multi per baris, tambahan jasa sebagai 'Nama: harga', toggle sebagai teks", () => {
    const v = toFormValues(
      [
        { key: "extras", label: "Tambahan", kind: "pricelist" },
        { key: "active", label: "Aktif", kind: "toggle" },
      ],
      { ...EMPTY.services, extras: [{ name: "Booking via WhatsApp", price: 300_000 }] },
    );
    expect(v).toEqual({ extras: "Booking via WhatsApp: 300.000", active: "true" });
    expect(toFormValues([{ key: "extras", label: "T", kind: "multi" }], { extras: ["A", "B"] })).toEqual({ extras: "A\nB" });
  });
});

describe("fromFormValues", () => {
  it("mengonversi dan merapikan input", () => {
    const { draft, errors } = fromFormValues("projects", PROJECT_FIELDS, {
      clientId: "c",
      price: "Rp1.400.000",
      qty: "2",
      link: "https://kasir-demo.web.app",
      nextDate: "2026-11-27",
    });
    expect(errors).toEqual({});
    expect(draft).toMatchObject({ clientId: "c", price: 1_400_000, qty: 2, nextDate: "2026-11-27" });
  });
  it("mempertahankan field di luar form dari record dasar", () => {
    const base = { ...EMPTY.projects, note: "catatan lama" };
    const { draft } = fromFormValues("projects", PROJECT_FIELDS, { clientId: "c" }, base);
    expect(draft.note).toBe("catatan lama");
  });
  it("pesan salah per field", () => {
    const { errors } = fromFormValues("projects", PROJECT_FIELDS, {
      clientId: "",
      price: "1,5 juta",
      qty: "dua",
      link: "kasir-demo.web.app",
      nextDate: "",
    });
    expect(Object.keys(errors).sort()).toEqual(["clientId", "link", "nextDate", "price", "qty"]);
  });
  it("jumlah tagihan kosong ditolak, select kosong nullable jadi null", () => {
    const fields: FieldDef[] = [
      { key: "clientId", label: "Klien", kind: "select" },
      { key: "amount", label: "Jumlah", kind: "money" },
      { key: "projectId", label: "Proyek", kind: "select", nullable: true, options: [] },
    ];
    const { draft, errors } = fromFormValues("payments", fields, { clientId: "c", amount: "", projectId: "" });
    expect(draft.amount).toBe(0);
    expect(draft.projectId).toBeNull();
    expect(errors).toHaveProperty("amount");
  });
  it("kontak: email polos jadi mailto:, link https tetap, tampil tanpa mailto:", () => {
    const fields: FieldDef[] = [
      { key: "name", label: "Nama", kind: "text" },
      { key: "contact", label: "Kontak", kind: "contact" },
    ];
    const mail = fromFormValues("clients", fields, { name: "A", contact: " halo@contoh.com " });
    expect(mail.draft.contact).toBe("mailto:halo@contoh.com");
    expect(mail.errors).toEqual({});
    expect(toFormValues(fields, mail.draft).contact).toBe("halo@contoh.com");
    expect(fromFormValues("clients", fields, { name: "A", contact: "https://t/x" }).draft.contact).toBe("https://t/x");
    expect(fromFormValues("clients", fields, { name: "A", contact: "halo@contoh" }).errors).toHaveProperty("contact");
  });
  it("jasa: tambahan, toggle, dan persen DP wajib", () => {
    const fields: FieldDef[] = [
      { key: "name", label: "Nama", kind: "text" },
      { key: "extras", label: "Tambahan", kind: "pricelist" },
      { key: "active", label: "Aktif", kind: "toggle" },
      { key: "dpPercent", label: "DP", kind: "count" },
    ];
    const ok = fromFormValues("services", fields, { name: "Web", extras: "Booking via WhatsApp: 300.000\n\n", active: "false", dpPercent: "30" });
    expect(ok.errors).toEqual({});
    expect(ok.draft).toMatchObject({ extras: [{ name: "Booking via WhatsApp", price: 300_000 }], active: false, dpPercent: 30 });
    const bad = fromFormValues("services", fields, { name: "Web", extras: "Booking 300rb", active: "true", dpPercent: "" });
    expect(Object.keys(bad.errors).sort()).toEqual(["dpPercent", "extras"]);
  });
  it("multi jadi daftar nama", () => {
    const { draft } = fromFormValues("projects", [{ key: "extras", label: "T", kind: "multi" }], { extras: "A\nB" });
    expect(draft.extras).toEqual(["A", "B"]);
  });
});

describe("parsePriceList", () => {
  it("nama boleh berisi titik dua, harga setelah titik dua terakhir", () => {
    expect(parsePriceList("Paket: hemat: 100.000")).toEqual([{ name: "Paket: hemat", price: 100_000 }]);
    expect(parsePriceList("")).toEqual([]);
    expect(parsePriceList(": 100")).toBeNull();
  });
});

describe("resolveField", () => {
  it("label, pilihan, dan sembunyi bergantung isian lain", () => {
    const f: FieldDef = {
      key: "qty",
      label: "Jumlah",
      kind: "count",
      dynamic: (v) => (v.unit ? { label: `Jumlah ${v.unit}` } : { hidden: true }),
    };
    expect(resolveField(f, { unit: "cabang" })).toMatchObject({ label: "Jumlah cabang", hidden: false });
    expect(resolveField(f, {}).hidden).toBe(true);
  });
});

describe("formSections", () => {
  const fields: FieldDef[] = [
    { key: "stage", label: "Tahap", kind: "choice", section: "Tindak lanjut" },
    { key: "nextDate", label: "Berikutnya", kind: "date", section: "Tindak lanjut" },
    { key: "name", label: "Nama", kind: "text", required: true, section: "Klien" },
    { key: "price", label: "Harga", kind: "money", section: "Harga" },
    { key: "next", label: "Langkah", kind: "text", section: "Tindak lanjut" },
  ];
  const shape = (isNew: boolean) => formSections(fields, isNew).map((s) => [s.title, s.fields.map((f) => f.key)]);

  it("mengedit: urutan konfigurasi, field sebagian dikumpulkan", () => {
    expect(shape(false)).toEqual([
      ["Tindak lanjut", ["stage", "nextDate", "next"]],
      ["Klien", ["name"]],
      ["Harga", ["price"]],
    ]);
  });
  it("data baru: bagian dengan isian wajib di atas", () => {
    expect(shape(true).map(([t]) => t)).toEqual(["Klien", "Tindak lanjut", "Harga"]);
  });
  it("tanpa section: satu bagian tanpa judul", () => {
    expect(formSections([{ key: "a", label: "A", kind: "text" }], false)).toEqual([
      { title: "", fields: [{ key: "a", label: "A", kind: "text" }] },
    ]);
  });
  it("choice disimpan seperti select", () => {
    const { draft } = fromFormValues("projects", [{ key: "stage", label: "Tahap", kind: "choice" }], { stage: "Menunggu kabar" });
    expect(draft.stage).toBe("Menunggu kabar");
  });
});
