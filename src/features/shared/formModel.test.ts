import { describe, expect, it } from "vitest";
import { EMPTY } from "../../domain/records";
import { fromFormValues, toFormValues, type FieldDef } from "./formModel";

const LEAD_FIELDS: FieldDef[] = [
  { key: "name", label: "Nama", kind: "text", required: true },
  { key: "value", label: "Nilai", kind: "money" },
  { key: "branches", label: "Cabang", kind: "count" },
  { key: "contact", label: "Kontak", kind: "url" },
  { key: "followUp", label: "Follow up", kind: "date" },
];

describe("toFormValues", () => {
  it("uang dengan titik ribuan, null jadi kosong", () => {
    const v = toFormValues(LEAD_FIELDS, { ...EMPTY.leads, name: "A", value: 1_400_000, branches: 2 });
    expect(v).toEqual({ name: "A", value: "1.400.000", branches: "2", contact: "", followUp: "" });
  });
  it("jumlah tagihan 0 (baru) tampil kosong", () => {
    expect(toFormValues([{ key: "amount", label: "Jumlah", kind: "money" }], EMPTY.payments)).toEqual({ amount: "" });
  });
});

describe("fromFormValues", () => {
  it("mengonversi dan merapikan input", () => {
    const { draft, errors } = fromFormValues("leads", LEAD_FIELDS, {
      name: "  Cumeyume ",
      value: "Rp1.400.000",
      branches: "2",
      contact: "https://www.threads.com/messages/t/1",
      followUp: "2026-11-27",
    });
    expect(errors).toEqual({});
    expect(draft).toMatchObject({ name: "Cumeyume", value: 1_400_000, branches: 2, followUp: "2026-11-27" });
  });
  it("mempertahankan field di luar form dari record dasar", () => {
    const base = { ...EMPTY.leads, note: "catatan lama" };
    const { draft } = fromFormValues("leads", LEAD_FIELDS, { name: "A" }, base);
    expect(draft.note).toBe("catatan lama");
  });
  it("pesan salah per field", () => {
    const { errors } = fromFormValues("leads", LEAD_FIELDS, {
      name: "",
      value: "1,5 juta",
      branches: "dua",
      contact: "threads.com/x",
      followUp: "",
    });
    expect(Object.keys(errors).sort()).toEqual(["branches", "contact", "name", "value"]);
  });
  it("jumlah tagihan kosong ditolak, select kosong nullable jadi null", () => {
    const fields: FieldDef[] = [
      { key: "client", label: "Klien", kind: "text" },
      { key: "amount", label: "Jumlah", kind: "money" },
      { key: "projectId", label: "Proyek", kind: "select", nullable: true, options: [] },
    ];
    const { draft, errors } = fromFormValues("payments", fields, { client: "A", amount: "", projectId: "" });
    expect(draft.amount).toBe(0);
    expect(draft.projectId).toBeNull();
    expect(errors).toHaveProperty("amount");
  });

  it("kontak: email polos jadi mailto:, link https tetap, tampil tanpa mailto:", () => {
    const fields: FieldDef[] = [
      { key: "name", label: "Nama", kind: "text" },
      { key: "contact", label: "Kontak", kind: "contact" },
    ];
    const mail = fromFormValues("leads", fields, { name: "A", contact: " halo@contoh.com " });
    expect(mail.draft.contact).toBe("mailto:halo@contoh.com");
    expect(mail.errors).toEqual({});
    expect(toFormValues(fields, mail.draft).contact).toBe("halo@contoh.com");
    expect(fromFormValues("leads", fields, { name: "A", contact: "https://t/x" }).draft.contact).toBe("https://t/x");
    expect(fromFormValues("leads", fields, { name: "A", contact: "halo@contoh" }).errors).toHaveProperty("contact");
  });
});
