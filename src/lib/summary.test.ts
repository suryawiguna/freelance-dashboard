import { describe, expect, it } from "vitest";
import { seedRecords } from "../domain/seedRecords";
import { EMPTY } from "../domain/records";
import type { Asset, Lead, Payment, Project } from "../domain/types";
import { summarize } from "./summary";

const TODAY = "2026-11-25";

const lead = (id: string, p: Partial<Lead>): Lead => ({ ...EMPTY.leads, id, name: id, ...p });
const project = (id: string, p: Partial<Project>): Project => ({ ...EMPTY.projects, id, client: id, ...p });
const payment = (id: string, p: Partial<Payment>): Payment => ({ ...EMPTY.payments, id, client: id, amount: 1000, ...p });
const asset = (id: string, p: Partial<Asset>): Asset => ({ ...EMPTY.assets, id, client: id, ...p });

const empty = { leads: [], projects: [], payments: [], assets: [] };

describe("data awal (PLAN §10)", () => {
  const s = summarize(seedRecords(), TODAY);
  it("5 lead terbuka, potensi setup Rp5.600.000", () => {
    expect(s.openLeads).toEqual({ count: 5, setupTotal: 5_600_000 });
  });
  it("angka lain dari data awal", () => {
    expect(s.monthlyRevenue).toBe(0);
    expect(s.unpaid).toEqual({ count: 0, total: 0 });
    expect(s.paidThisMonth).toEqual({ count: 0, total: 0 });
    expect(s.renewalsSoon).toBe(0);
  });
  it("tindak lanjut: dua follow up tanggal 27 Nov", () => {
    expect(s.followUps.map((f) => [f.id, f.label])).toEqual([
      ["dimsum-online", "2 hari lagi"],
      ["mini-cafe", "2 hari lagi"],
    ]);
  });
});

describe("lead terbuka", () => {
  it("hanya Baru, Menunggu kabar, Kirim harga, Nego; nilai kosong dihitung 0", () => {
    const s = summarize(
      {
        ...empty,
        leads: [
          lead("a", { stage: "Baru", value: null }),
          lead("b", { stage: "Kirim harga", value: 100 }),
          lead("c", { stage: "Nego", value: 200 }),
          lead("g", { stage: "Menunggu kabar", value: 50 }),
          lead("d", { stage: "Deal", value: 1000 }),
          lead("e", { stage: "On hold", value: 1000 }),
          lead("f", { stage: "Tutup", value: 1000 }),
        ],
      },
      TODAY,
    );
    expect(s.openLeads).toEqual({ count: 4, setupTotal: 350 });
  });
});

describe("pendapatan bulanan", () => {
  it("monthly dari proyek Live dan Maintenance saja", () => {
    const s = summarize(
      {
        ...empty,
        projects: [
          project("a", { status: "Live", monthly: 145_000 }),
          project("b", { status: "Maintenance", monthly: 290_000 }),
          project("c", { status: "Dikerjakan", monthly: 999 }),
          project("d", { status: "Selesai", monthly: 999 }),
          project("e", { status: "Live", monthly: null }),
        ],
      },
      TODAY,
    );
    expect(s.monthlyRevenue).toBe(435_000);
  });
});

describe("tagihan", () => {
  const payments = [
    payment("a", { status: "Belum", amount: 700_000 }),
    payment("b", { status: "Belum", amount: 300_000 }),
    payment("c", { status: "Lunas", amount: 500_000, paidAt: "2026-11-01" }),
    payment("d", { status: "Lunas", amount: 400_000, paidAt: "2026-11-30" }),
    payment("e", { status: "Lunas", amount: 999, paidAt: "2026-10-31" }),
    payment("f", { status: "Lunas", amount: 999, paidAt: "" }),
  ];
  const s = summarize({ ...empty, payments }, TODAY);
  it("belum dibayar = semua yang belum Lunas", () => {
    expect(s.unpaid).toEqual({ count: 2, total: 1_000_000 });
  });
  it("lunas bulan ini memakai paidAt di bulan berjalan", () => {
    expect(s.paidThisMonth).toEqual({ count: 2, total: 900_000 });
  });
});

describe("perpanjangan dekat", () => {
  it("renewal dalam 30 hari, termasuk yang sudah lewat", () => {
    const s = summarize(
      {
        ...empty,
        assets: [
          asset("a", { renewal: "2026-12-25" }), // 30 hari
          asset("b", { renewal: "2026-12-26" }), // 31 hari
          asset("c", { renewal: "2026-11-20" }), // lewat
          asset("d", { renewal: "" }),
        ],
      },
      TODAY,
    );
    expect(s.renewalsSoon).toBe(2);
    expect(s.followUps.map((f) => f.id)).toEqual(["c", "a"]);
  });
});

describe("perlu ditindaklanjuti", () => {
  const s = summarize(
    {
      leads: [
        lead("l-lewat", { stage: "Nego", followUp: "2026-11-23" }),
        lead("l-3", { stage: "Baru", followUp: "2026-11-28" }),
        lead("l-4", { stage: "Baru", followUp: "2026-11-29" }),
        lead("l-deal", { stage: "Deal", followUp: "2026-11-25" }),
        lead("l-kosong", { stage: "Baru", followUp: "" }),
      ],
      projects: [
        project("p-7", { status: "Dikerjakan", due: "2026-12-02" }),
        project("p-8", { status: "Revisi", due: "2026-12-03" }),
        project("p-live", { status: "Live", due: "2026-11-26" }),
        project("p-selesai", { status: "Selesai", due: "2026-11-26" }),
      ],
      payments: [
        payment("pay-hari-ini", { status: "Belum", due: "2026-11-25" }),
        payment("pay-lunas", { status: "Lunas", due: "2026-11-25" }),
        payment("pay-8", { status: "Belum", due: "2026-12-03" }),
      ],
      assets: [asset("a-30", { renewal: "2026-12-25" })],
    },
    TODAY,
  );

  it("memilih item sesuai jendela tiap jenis dan mengurutkan per tanggal", () => {
    expect(s.followUps.map((f) => f.id)).toEqual(["l-lewat", "pay-hari-ini", "l-3", "p-7", "a-30"]);
  });
  it("lewat = merah dengan teks, sisanya kuning", () => {
    expect(s.followUps.map((f) => [f.tone, f.label])).toEqual([
      ["late", "Lewat 2 hari"],
      ["near", "Hari ini"],
      ["near", "3 hari lagi"],
      ["near", "7 hari lagi"],
      ["near", "30 hari lagi"],
    ]);
  });
  it("tanggal rusak diabaikan, tidak melempar", () => {
    expect(() => summarize({ ...empty, leads: [lead("x", { followUp: "besok" })] }, TODAY)).not.toThrow();
  });
});
