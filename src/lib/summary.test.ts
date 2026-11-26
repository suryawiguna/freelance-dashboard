import { describe, expect, it } from "vitest";
import { seedRecords } from "../domain/seedRecords";
import { EMPTY } from "../domain/records";
import type { Asset, Client, Payment, Project } from "../domain/types";
import { buildClientViews, lastContact } from "./clients";
import { waLink } from "./contact";
import { summarize } from "./summary";

const TODAY = "2026-11-25";

const client = (id: string, p: Partial<Client> = {}): Client => ({ ...EMPTY.clients, id, name: `Klien ${id}`, ...p });
const project = (id: string, p: Partial<Project> = {}): Project => ({ ...EMPTY.projects, id, clientId: "c", name: id, ...p });
const payment = (id: string, p: Partial<Payment> = {}): Payment => ({ ...EMPTY.payments, id, clientId: "c", amount: 1000, ...p });
const asset = (id: string, p: Partial<Asset> = {}): Asset => ({ ...EMPTY.assets, id, item: id, ...p });

const empty = { clients: [client("c")], projects: [], payments: [], assets: [] };

describe("data awal", () => {
  const seed = seedRecords();
  const s = summarize(seed, TODAY);
  it("prospek: 4 proyek, potensi Rp4.200.000 (Aneka Ayam sudah dikerjakan)", () => {
    expect(s.prospects).toEqual({ count: 4, total: 4_200_000 });
  });
  it("angka lain dari data awal", () => {
    expect(s.monthlyRevenue).toEqual({ count: 0, total: 0 });
    expect(s.unpaid).toEqual({ count: 0, total: 0 });
    expect(s.paidThisMonth).toEqual({ count: 0, total: 0 });
    expect(s.pendingBills.bills).toEqual([]);
  });
  it("hubungi: prospek dan On hold, urut tanggal; kerjakan: Aneka Ayam", () => {
    expect(s.groups.contact.map((f) => [f.id, f.label])).toEqual([
      ["aura-bali-tours", "Hari ini"],
      ["beautybar", "Hari ini"],
      ["cumeyume", "Hari ini"],
      ["dimsum-online", "2 hari lagi"],
      ["mini-cafe", "2 hari lagi"],
    ]);
    expect(s.groups.work.map((f) => [f.id, f.title])).toEqual([["kasir-base", "Aneka Ayam Manado"]]);
    expect(s.groups.payment).toEqual([]);
    expect(s.groups.renewal).toEqual([]);
  });
  it("status klien dari proyek utama", () => {
    const views = buildClientViews(seed.clients, seed.projects, seed.payments);
    expect(views.get("aneka-ayam")).toMatchObject({ stage: "Dikerjakan", phase: "Dikerjakan" });
    expect(views.get("freedom-villa")).toMatchObject({ stage: "Batal", phase: "Tutup" });
    expect(views.get("aneka-ayam")?.money).toEqual({ deal: 1_400_000, monthly: 0, paid: 0, unpaid: 0 });
  });
});

describe("kelompok Hari ini", () => {
  it("hubungi dalam 3 hari, yang lewat selalu masuk; proyek Live dan tutup tidak", () => {
    const s = summarize(
      {
        ...empty,
        projects: [
          project("lewat", { stage: "Nego", nextDate: "2026-11-01" }),
          project("tiga", { stage: "Menunggu kabar", nextDate: "2026-11-28" }),
          project("empat", { stage: "Baru", nextDate: "2026-11-29" }),
          project("hold", { stage: "On hold", nextDate: "2026-11-25" }),
          project("batal", { stage: "Batal", nextDate: "2026-11-25" }),
        ],
      },
      TODAY,
    );
    expect(s.groups.contact.map((f) => [f.id, f.tone, f.label])).toEqual([
      ["lewat", "late", "Lewat 24 hari"],
      ["hold", "near", "Hari ini"],
      ["tiga", "near", "3 hari lagi"],
    ]);
  });
  it("kerjakan: tanggal terdekat antara langkah berikutnya dan deadline, juga tugas proyek Live", () => {
    const s = summarize(
      {
        ...empty,
        projects: [
          project("dl", { stage: "Dikerjakan", nextDate: "2026-12-20", due: "2026-11-30", next: "Kirim draft" }),
          project("nx", { stage: "Revisi", nextDate: "2026-11-26", due: "2026-12-30", next: "Revisi warna" }),
          project("live", { stage: "Live", nextDate: "2026-11-27", next: "Cek backup" }),
          project("jauh", { stage: "Deal", nextDate: "2026-12-25" }),
        ],
      },
      TODAY,
    );
    expect(s.groups.work.map((f) => [f.id, f.date, f.detail])).toEqual([
      ["nx", "2026-11-26", "nx: Revisi warna"],
      ["live", "2026-11-27", "live: Cek backup"],
      ["dl", "2026-11-30", "dl: deadline"],
    ]);
  });
  it("tagih: belum lunas dalam 7 hari; perpanjang: aset dalam 30 hari, milik sendiri ikut", () => {
    const s = summarize(
      {
        ...empty,
        payments: [
          payment("a", { due: "2026-12-02", type: "DP" }),
          payment("b", { due: "2026-12-03" }),
          payment("lunas", { due: "2026-11-20", status: "Lunas" }),
        ],
        assets: [asset("dom.com", { kind: "Domain", renewal: "2026-12-25" }), asset("jauh", { renewal: "2026-12-26" })],
      },
      TODAY,
    );
    expect(s.groups.payment.map((f) => [f.id, f.title, f.detail])).toEqual([["a", "Klien c", "Tagihan DP"]]);
    expect(s.groups.renewal.map((f) => [f.id, f.detail])).toEqual([["dom.com", "Perpanjangan Domain, Milik sendiri"]]);
  });
});

describe("angka", () => {
  it("pendapatan bulanan dari proyek Live, lunas bulan ini lewat paidAt, prospek dari harga penawaran", () => {
    const s = summarize(
      {
        ...empty,
        projects: [
          project("l1", { stage: "Live", monthly: 290_000 }),
          project("l2", { stage: "Live", monthly: 145_000 }),
          project("sel", { stage: "Selesai", monthly: 999 }),
          project("p1", { stage: "Kirim harga", price: 1_400_000, nextDate: TODAY }),
          project("p2", { stage: "Baru", price: null, nextDate: TODAY }),
        ],
        payments: [
          payment("x", { status: "Lunas", paidAt: "2026-11-02", amount: 700_000 }),
          payment("y", { status: "Lunas", paidAt: "2026-10-30", amount: 5 }),
          payment("z", { amount: 300 }),
        ],
      },
      TODAY,
    );
    expect(s.monthlyRevenue).toEqual({ count: 2, total: 435_000 });
    expect(s.paidThisMonth).toEqual({ count: 1, total: 700_000 });
    expect(s.unpaid).toEqual({ count: 1, total: 300 });
    expect(s.prospects).toEqual({ count: 2, total: 1_400_000 });
    expect(s.pendingBills.bills.map((b) => b.id)).toEqual(["l1-2026-11", "l2-2026-11"]);
  });
});

describe("klien", () => {
  it("proyek utama: dikerjakan dulu, lalu prospek, lalu live, lalu tutup", () => {
    const views = buildClientViews(
      [client("c")],
      [
        project("live", { stage: "Live" }),
        project("prospek", { stage: "Nego", nextDate: "2026-11-27" }),
        project("kerja", { stage: "Revisi", nextDate: "2026-12-01" }),
        project("batal", { stage: "Batal" }),
      ],
      [payment("a", { status: "Lunas", amount: 10 }), payment("b", { amount: 5 }), payment("lain", { clientId: "x" })],
    );
    const v = views.get("c")!;
    expect(v.projects.map((p) => p.id)).toEqual(["kerja", "prospek", "live", "batal"]);
    expect(v.otherActive).toBe(2);
    expect(v.money).toMatchObject({ paid: 10, unpaid: 5 });
  });
  it("klien tanpa proyek: tanpa status", () => {
    expect(buildClientViews([client("c")], [], []).get("c")).toMatchObject({ primary: null, stage: null, phase: null });
  });
  it("terakhir dihubungi = tanggal terbaru di log", () => {
    expect(lastContact({ log: [{ date: "2026-11-01", text: "" }, { date: "2026-11-20", text: "" }] })).toBe("2026-11-20");
    expect(lastContact({ log: [] })).toBe("");
  });
  it("link WA dari nomor bebas", () => {
    expect(waLink("0812-3456 7890")).toBe("https://wa.me/6281234567890");
    expect(waLink("+62 812 3456 7890")).toBe("https://wa.me/6281234567890");
    expect(waLink("123")).toBe("");
  });
});
