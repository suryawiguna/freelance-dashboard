import { describe, expect, it } from "vitest";
import { bumpFollowUp, monthlyForBranches, projectFromLead } from "./leadActions";
import { EMPTY, normalize } from "./records";
import { validate } from "./validate";

describe("normalize", () => {
  it("mengisi field yang hilang dan membuang field asing", () => {
    const l = normalize("leads", "x", { name: "A", stage: "Nego", value: 5, createdAt: {}, extra: 1 });
    expect(l).toEqual({ ...EMPTY.leads, id: "x", name: "A", stage: "Nego", value: 5 });
  });
  it("tipe salah jadi nilai kosong", () => {
    const p = normalize("payments", "y", { client: 5, amount: "100", projectId: "p1" });
    expect(p.client).toBe("");
    expect(p.amount).toBe(0);
    expect(p.projectId).toBe("p1");
  });
});

describe("validate", () => {
  it("lead kosong: nama wajib", () => {
    expect(validate("leads", EMPTY.leads)).toEqual({ name: "Wajib diisi." });
  });
  it("lead: kontak harus https, tanggal valid, cabang >= 1", () => {
    const e = validate("leads", { ...EMPTY.leads, name: "A", contact: "http://x", followUp: "2026-02-30", branches: 0 });
    expect(Object.keys(e).sort()).toEqual(["branches", "contact", "followUp"]);
  });
  it("tagihan: jumlah wajib > 0", () => {
    expect(validate("payments", { ...EMPTY.payments, client: "A" })).toEqual({ amount: "Wajib diisi, lebih dari 0." });
    expect(validate("payments", { ...EMPTY.payments, client: "A", amount: 1 })).toEqual({});
  });
  it("proyek dan aset: klien wajib", () => {
    expect(validate("projects", EMPTY.projects)).toHaveProperty("client");
    expect(validate("assets", EMPTY.assets)).toHaveProperty("client");
    expect(validate("assets", { ...EMPTY.assets, client: "A", cost: -1 })).toHaveProperty("cost");
  });
});

describe("bumpFollowUp", () => {
  it("+3 dari tanggal follow up bila masih di depan", () => {
    expect(bumpFollowUp("2026-11-27", "2026-11-25")).toBe("2026-11-30");
  });
  it("+3 dari hari ini bila kosong, hari ini, atau sudah lewat", () => {
    expect(bumpFollowUp("", "2026-11-25")).toBe("2026-11-28");
    expect(bumpFollowUp("2026-11-25", "2026-11-25")).toBe("2026-11-28");
    expect(bumpFollowUp("2026-11-01", "2026-11-25")).toBe("2026-11-28");
  });
});

describe("lead ke proyek", () => {
  it("biaya bulanan Rp145.000 per cabang", () => {
    expect(monthlyForBranches(2)).toBe(290_000);
    expect(monthlyForBranches(null)).toBeNull();
  });
  it("klien, link, dan biaya bulanan sama", () => {
    const lead = { ...EMPTY.leads, id: "l1", name: "Aneka Ayam", service: "Kasir", contact: "https://t/x", monthly: 290_000 };
    expect(projectFromLead(lead)).toMatchObject({
      client: "Aneka Ayam",
      leadId: "l1",
      name: "Kasir",
      status: "Belum mulai",
      monthly: 290_000,
      link: "https://t/x",
    });
  });
});
