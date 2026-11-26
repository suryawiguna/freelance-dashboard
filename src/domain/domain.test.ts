import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { monthlyBillId, monthlyDue, pendingMonthlyBills } from "./billing";
import { matchService, migrateV1, DEFAULT_SERVICES } from "./migrateV1";
import { quote } from "./pricing";
import { becameDealt, bumpDate, dealBills, stampStage } from "./projectFlow";
import { EMPTY, normalize } from "./records";
import { NEXT_REQUIRED_STAGES, STAGES, type Payment, type Project, type Service } from "./types";
import { validate } from "./validate";

const service = (p: Partial<Service> = {}): Service => ({ ...EMPTY.services, id: "s", name: "S", ...p });
const project = (id: string, p: Partial<Project> = {}): Project => ({ ...EMPTY.projects, id, clientId: "c", ...p });
const payment = (id: string, p: Partial<Payment> = {}): Payment => ({ ...EMPTY.payments, id, clientId: "c", amount: 1, ...p });

describe("normalize", () => {
  it("mengisi field yang hilang dan membuang field asing", () => {
    const c = normalize("clients", "x", { name: "A", source: "Threads", createdAt: {}, stage: "Nego" });
    expect(c).toEqual({ ...EMPTY.clients, id: "x", name: "A", source: "Threads" });
  });
  it("tipe salah jadi nilai kosong", () => {
    const p = normalize("payments", "y", { clientId: 5, amount: "100", projectId: "p1" });
    expect(p.clientId).toBe("");
    expect(p.amount).toBe(0);
    expect(p.projectId).toBe("p1");
  });
  it("daftar: elemen rusak dibuang, bukan daftar jadi kosong", () => {
    const c = normalize("clients", "x", { name: "A", log: [{ date: "2026-11-25", text: "a" }, { date: 1 }, "x"] });
    expect(c.log).toEqual([{ date: "2026-11-25", text: "a" }]);
    expect(normalize("clients", "x", { log: "x" }).log).toEqual([]);
    const s = normalize("services", "s", { extras: [{ name: "WA", price: 300 }, { name: "x" }] });
    expect(s.extras).toEqual([{ name: "WA", price: 300 }]);
    expect(normalize("projects", "p", { extras: ["WA", 2] }).extras).toEqual(["WA"]);
  });
  it("aktif bawaan true, klien aset bawaan null", () => {
    expect(normalize("services", "s", {}).active).toBe(true);
    expect(normalize("assets", "a", {}).clientId).toBeNull();
  });
});

describe("validate", () => {
  it("klien kosong: nama wajib", () => {
    expect(validate("clients", EMPTY.clients)).toEqual({ name: "Wajib diisi." });
  });
  it("klien: kontak https atau mailto, WA angka saja", () => {
    const e = validate("clients", { ...EMPTY.clients, name: "A", contact: "http://x", phone: "08a" });
    expect(Object.keys(e).sort()).toEqual(["contact", "phone"]);
    expect(validate("clients", { ...EMPTY.clients, name: "A", contact: "mailto:a@b.co", phone: "+62 812-1" })).toEqual({});
  });
  it("proyek: klien wajib, tanggal berikutnya wajib selama belum Live/Selesai/Batal", () => {
    expect(validate("projects", EMPTY.projects)).toHaveProperty("clientId");
    for (const stage of STAGES) {
      const e = validate("projects", { ...EMPTY.projects, clientId: "c", stage });
      expect(!!e.nextDate).toBe(NEXT_REQUIRED_STAGES.includes(stage));
    }
    expect(validate("projects", { ...EMPTY.projects, clientId: "c", nextDate: "2026-11-27", qty: 0 })).toHaveProperty("qty");
  });
  it("jasa: DP 0 sampai 100, tambahan bernama", () => {
    expect(validate("services", { ...EMPTY.services, name: "A", dpPercent: 101 })).toHaveProperty("dpPercent");
    expect(validate("services", { ...EMPTY.services, name: "A", extras: [{ name: " ", price: 1 }] })).toHaveProperty("extras");
    expect(validate("services", { ...EMPTY.services, name: "A" })).toEqual({});
  });
  it("tagihan: klien wajib, jumlah > 0, bulan YYYY-MM", () => {
    expect(validate("payments", { ...EMPTY.payments, clientId: "c" })).toEqual({ amount: "Wajib diisi, lebih dari 0." });
    expect(validate("payments", { ...EMPTY.payments, clientId: "c", amount: 1, period: "2026-13" })).toHaveProperty("period");
    expect(validate("payments", { ...EMPTY.payments, clientId: "c", amount: 1 })).toEqual({});
  });
  it("aset: item wajib, klien boleh kosong (milik sendiri)", () => {
    expect(validate("assets", EMPTY.assets)).toEqual({ item: "Wajib diisi." });
    expect(validate("assets", { ...EMPTY.assets, item: "a.com", cost: -1 })).toHaveProperty("cost");
  });
});

describe("quote", () => {
  const kasir = service({ setup: 1_400_000, monthly: 145_000, unit: "cabang" });
  const web = service({ setup: 4_500_000, extras: [{ name: "Booking via WhatsApp", price: 300_000 }] });
  it("kasir: Rp145.000 per cabang, tanpa jumlah = 1 cabang", () => {
    expect(quote(kasir, [], 2)).toEqual({ price: 1_400_000, monthly: 290_000 });
    expect(quote(kasir, [], null)).toEqual({ price: 1_400_000, monthly: 145_000 });
  });
  it("website + booking WA = Rp4.800.000", () => {
    expect(quote(web, ["Booking via WhatsApp"], null)).toEqual({ price: 4_800_000, monthly: null });
    expect(quote(web, ["Sudah dihapus"], null).price).toBe(4_500_000);
  });
  it("tanpa jasa atau tanpa harga = kosong", () => {
    expect(quote(undefined, [], 1)).toEqual({ price: null, monthly: null });
    expect(quote(service(), [], 1)).toEqual({ price: null, monthly: null });
  });
  it("tanpa satuan: biaya bulanan tidak dikali", () => {
    expect(quote(service({ monthly: 100 }), [], 3).monthly).toBe(100);
  });
});

describe("alur proyek", () => {
  it("geser tanggal +3 dari tanggal sekarang bila di depan, selain itu dari hari ini", () => {
    expect(bumpDate("2026-11-27", "2026-11-25")).toBe("2026-11-30");
    expect(bumpDate("", "2026-11-25")).toBe("2026-11-28");
    expect(bumpDate("2026-11-01", "2026-11-25")).toBe("2026-11-28");
  });
  it("dealAt dan liveAt terisi sekali saat tahap sampai", () => {
    const t = "2026-11-25";
    expect(stampStage({ stage: "Nego", dealAt: "", liveAt: "" }, t)).toEqual({ stage: "Nego", dealAt: "", liveAt: "" });
    expect(stampStage({ stage: "Deal", dealAt: "", liveAt: "" }, t)).toEqual({ stage: "Deal", dealAt: t, liveAt: "" });
    expect(stampStage({ stage: "Live", dealAt: "2026-01-01", liveAt: "" }, t)).toEqual({ stage: "Live", dealAt: "2026-01-01", liveAt: t });
  });
  it("momen deal: dari prospek ke Deal atau setelahnya", () => {
    expect(becameDealt("Nego", "Deal")).toBe(true);
    expect(becameDealt(null, "Dikerjakan")).toBe(true);
    expect(becameDealt("Deal", "Dikerjakan")).toBe(false);
    expect(becameDealt("Nego", "Batal")).toBe(false);
  });
  it("tagihan saat deal mengikuti persen DP jasa", () => {
    const p = { clientId: "c", price: 1_400_000, due: "2026-12-10" };
    const t = "2026-11-25";
    expect(dealBills("p", p, service({ dpPercent: 50 }), t).map((b) => [b.type, b.amount, b.due])).toEqual([
      ["DP", 700_000, t],
      ["Pelunasan", 700_000, "2026-12-10"],
    ]);
    expect(dealBills("p", p, service({ dpPercent: 100 }), t).map((b) => [b.type, b.amount])).toEqual([["Setup", 1_400_000]]);
    expect(dealBills("p", p, service({ dpPercent: 0 }), t).map((b) => [b.type, b.amount])).toEqual([["Pelunasan", 1_400_000]]);
    expect(dealBills("p", { ...p, price: 4_800_000 }, service({ dpPercent: 30 }), t).map((b) => b.amount)).toEqual([1_440_000, 3_360_000]);
    expect(dealBills("p", { ...p, price: null }, undefined, t)).toEqual([]);
    expect(dealBills("p", p, undefined, t)[0]).toMatchObject({ clientId: "c", projectId: "p", status: "Belum" });
  });
});

describe("tagihan langganan bulanan", () => {
  const live = project("k", { stage: "Live", monthly: 290_000, liveAt: "2026-10-31" });
  it("jatuh tempo di tanggal live, dipotong ke akhir bulan", () => {
    expect(monthlyDue("2026-10-31", "2026-11")).toBe("2026-11-30");
    expect(monthlyDue("2026-10-31", "2027-02")).toBe("2027-02-28");
    expect(monthlyDue("", "2026-12")).toBe("2026-12-01");
  });
  it("satu tagihan per proyek Live ber-biaya bulanan, id stabil", () => {
    const bills = pendingMonthlyBills(
      [live, project("a", { stage: "Live", monthly: null }), project("b", { stage: "Dikerjakan", monthly: 1 })],
      [],
      "2026-12",
    );
    expect(bills).toEqual([
      {
        id: "k-2026-12",
        draft: {
          clientId: "c",
          projectId: "k",
          type: "Langganan",
          item: "Langganan Des 2026",
          period: "2026-12",
          amount: 290_000,
          due: "2026-12-31",
          status: "Belum",
          paidAt: "",
        },
      },
    ]);
  });
  it("tidak dobel: sudah ada lewat id atau lewat period", () => {
    expect(pendingMonthlyBills([live], [payment(monthlyBillId("k", "2026-12"))], "2026-12")).toEqual([]);
    expect(pendingMonthlyBills([live], [payment("lain", { projectId: "k", type: "Langganan", period: "2026-12" })], "2026-12")).toEqual([]);
    expect(pendingMonthlyBills([live], [payment("lain", { projectId: "k", type: "Langganan", period: "2026-11" })], "2026-12")).toHaveLength(1);
  });
  it("belum live di bulan itu = belum ditagih", () => {
    expect(pendingMonthlyBills([live], [], "2026-09")).toEqual([]);
  });
});

describe("migrasi v1", () => {
  const v1 = JSON.parse(readFileSync(resolve(__dirname, "../../scripts/seed-data-v1.json"), "utf8"));
  const { data, report } = migrateV1(v1, "2026-11-25");

  it("hasil migrasi Lampiran A = scripts/seed-data.json", () => {
    const seed = JSON.parse(readFileSync(resolve(__dirname, "../../scripts/seed-data.json"), "utf8"));
    expect(data).toEqual(seed);
  });
  it("lead + proyek dengan nama klien sama jadi satu proyek", () => {
    const p = data.projects.find((x) => x.id === "kasir-base");
    expect(p).toMatchObject({ clientId: "aneka-ayam", serviceId: "kasir", stage: "Dikerjakan", price: 1_400_000, qty: 2, monthly: 290_000 });
    expect(data.projects.some((x) => x.id === "aneka-ayam")).toBe(false);
    expect(report.some((r) => r.includes("aneka-ayam"))).toBe(true);
  });
  it("tahap v1: Tutup jadi Batal, On hold dan prospek tanpa tanggal diisi hari migrasi", () => {
    expect(data.projects.find((x) => x.id === "freedom-villa")).toMatchObject({ stage: "Batal", nextDate: "" });
    expect(data.projects.find((x) => x.id === "aura-bali-tours")).toMatchObject({
      stage: "On hold",
      nextDate: "2026-11-25",
      price: 4_800_000,
      serviceId: "website",
      extras: ["Booking via WhatsApp"],
    });
  });
  it("aset 'Semua ...' jadi milik sendiri", () => {
    expect(data.assets.map((a) => a.clientId)).toEqual([null, null]);
  });
  it("tagihan dan aset v1 dicocokkan ke klien lewat nama, klien baru bila tidak ada", () => {
    const { data: d, report: r } = migrateV1(
      {
        leads: [{ id: "l1", name: "Aneka Ayam", stage: "Deal" }],
        projects: [{ id: "p1", client: "Klien Lama", status: "Maintenance", monthly: 100 }],
        payments: [
          { id: "pay1", client: "aneka ayam ", type: "DP", amount: 5, status: "Lunas", paidAt: "2026-11-01" },
          { id: "pay2", client: "Klien Lama", projectId: "p1", type: "Langganan", amount: 100, status: "Belum" },
        ],
        assets: [{ id: "a1", client: "Toko Baru", item: "", kind: "VPS" }],
      },
      "2026-11-25",
    );
    expect(d.payments.map((p) => [p.clientId, p.projectId])).toEqual([
      ["l1", null],
      ["klien-lama", "p1"],
    ]);
    expect(d.projects.find((p) => p.id === "p1")).toMatchObject({ clientId: "klien-lama", stage: "Live", monthly: 100 });
    expect(d.projects.find((p) => p.id === "l1")).toMatchObject({ stage: "Deal", nextDate: "2026-11-25" });
    expect(d.assets[0]).toMatchObject({ clientId: "toko-baru", item: "Toko Baru", kind: "Lainnya" });
    expect(r.filter((x) => x.startsWith("Klien baru"))).toHaveLength(2);
  });
  it("jasa yang sudah ada tidak dibuat ulang", () => {
    const { data: d } = migrateV1({ leads: [{ id: "l", name: "A", service: "Kasir", stage: "Baru" }] }, "2026-11-25", [
      { ...DEFAULT_SERVICES[0], id: "kasir-lama" },
    ]);
    expect(d.services).toEqual([]);
    expect(d.projects[0].serviceId).toBe("kasir-lama");
  });
  it("teks layanan ke jasa", () => {
    expect(matchService("Kasir (2 cabang)", DEFAULT_SERVICES)).toEqual({ serviceId: "kasir", extras: [] });
    expect(matchService("Upgrade WordPress", DEFAULT_SERVICES).serviceId).toBe("upgrade-wordpress");
    expect(matchService("", DEFAULT_SERVICES)).toEqual({ serviceId: null, extras: [] });
  });
});
