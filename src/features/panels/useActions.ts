import { useCallback, useMemo } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useData } from "../../data/DataContext";
import { useLookup } from "../../data/useLookup";
import { batch, newId, ops, update } from "../../data/repo";
import type { PendingBill } from "../../domain/billing";
import { becameDealt, bumpDate, dealBills, needsNext, stampStage } from "../../domain/projectFlow";
import type { Draft } from "../../domain/records";
import { LIMITS, type Asset, type Client, type LogEntry, type Payment, type Project, type Stage } from "../../domain/types";
import { addDays, addYears, formatDate, isDateStr, todayWita } from "../../lib/dates";
import { formatRupiah } from "../../lib/money";

/**
 * Aksi cepat yang dipakai di beberapa halaman (Hari ini, detail klien, panel).
 * Semua penulisan tidak ditunggu (offline persistence); error lewat toast.
 */
export function useActions() {
  const toast = useToast();
  const ask = useConfirm();
  const { payments } = useData();
  const lookup = useLookup();

  const failed = useCallback(
    (what: string) => (e: unknown) => {
      console.error(e);
      toast(`Gagal ${what}. Periksa koneksi, lalu coba lagi.`, "error");
    },
    [toast],
  );

  /** Saat proyek baru deal dan belum punya tagihan: tawarkan DP/pelunasan sesuai jasa. */
  const offerDealBills = useCallback(
    async (projectId: string, project: Draft<Project>) => {
      if (payments.some((p) => p.projectId === projectId)) return;
      const bills = dealBills(projectId, project, lookup.service(project.serviceId), todayWita());
      if (bills.length === 0) return;
      const lines = bills.map((b) => `${b.type} ${formatRupiah(b.amount)}${b.due ? `, jatuh tempo ${formatDate(b.due)}` : ""}`);
      const ok = await ask({
        title: "Buat tagihan untuk deal ini?",
        body: `${lines.join(". ")}. Nominal dan tanggalnya bisa diubah nanti.`,
        confirmLabel: "Buat tagihan",
        tone: "primary",
      });
      if (!ok) return;
      batch(bills.map((b) => ops.create("payments", newId("payments"), b))).catch(failed("membuat tagihan"));
      toast(`${bills.length} tagihan dibuat.`);
    },
    [payments, lookup, ask, toast, failed],
  );

  /** Ganti tahap langsung (chip/select di detail klien). */
  const setStage = useCallback(
    (project: Project, stage: Stage) => {
      const today = todayWita();
      const next = stampStage({ ...project, stage }, today);
      const patch: Partial<Draft<Project>> = { stage, dealAt: next.dealAt, liveAt: next.liveAt };
      if (needsNext(stage) && !isDateStr(project.nextDate)) patch.nextDate = addDays(today, 1);
      update("projects", project.id, patch).catch(failed("mengganti tahap"));
      toast(patch.nextDate ? `Tahap jadi ${stage}. Tanggal berikutnya diisi besok.` : `Tahap jadi ${stage}.`);
      if (becameDealt(project.stage, stage)) {
        const { id, ...draft } = { ...project, ...patch };
        void offerDealBills(id, draft);
      }
    },
    [toast, failed, offerDealBills],
  );

  /** "Sudah dihubungi": catat di riwayat klien dan geser tanggal berikutnya 3 hari. */
  const contacted = useCallback(
    (project: Project) => {
      const client = lookup.client(project.clientId);
      const today = todayWita();
      const nextDate = bumpDate(project.nextDate, today);
      const entry: LogEntry = { date: today, text: project.next ? `Dihubungi: ${project.next}` : "Dihubungi" };
      const list = [ops.update("projects", project.id, { nextDate })];
      if (client) list.push(ops.update("clients", client.id, { log: [entry, ...client.log].slice(0, LIMITS.log) }));
      batch(list).catch(failed("mencatat"));
      toast(`Dicatat. Berikutnya ${formatDate(nextDate)}.`);
    },
    [lookup, toast, failed],
  );

  const addLog = useCallback(
    (client: Client, entry: LogEntry) => {
      const log = [entry, ...client.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMITS.log);
      update("clients", client.id, { log }).catch(failed("menyimpan catatan"));
    },
    [failed],
  );

  const removeLog = useCallback(
    async (client: Client, index: number) => {
      const entry = client.log[index];
      if (!entry) return;
      const ok = await ask({
        title: "Hapus catatan ini?",
        body: `"${entry.text}" (${formatDate(entry.date)}) akan dihapus dari riwayat.`,
        confirmLabel: "Ya, hapus",
        tone: "danger",
      });
      if (!ok) return;
      update("clients", client.id, { log: client.log.filter((_, i) => i !== index) }).catch(failed("menghapus catatan"));
    },
    [ask, failed],
  );

  const markPaid = useCallback(
    (p: Payment) => {
      update("payments", p.id, { status: "Lunas", paidAt: todayWita() }).catch(failed("menyimpan"));
      toast(`Tagihan ${formatRupiah(p.amount)} ditandai lunas.`);
    },
    [toast, failed],
  );

  const renewed = useCallback(
    (a: Asset) => {
      const renewal = addYears(isDateStr(a.renewal) ? a.renewal : todayWita(), 1);
      update("assets", a.id, { renewal }).catch(failed("menyimpan"));
      toast(`Perpanjangan berikutnya ${formatDate(renewal)}.`);
    },
    [toast, failed],
  );

  const createMonthly = useCallback(
    (bills: readonly PendingBill[]) => {
      if (bills.length === 0) return;
      batch(bills.map((b) => ops.create("payments", b.id, b.draft))).catch(failed("membuat tagihan langganan"));
      toast(`${bills.length} tagihan langganan dibuat.`);
    },
    [toast, failed],
  );

  return useMemo(
    () => ({ offerDealBills, setStage, contacted, addLog, removeLog, markPaid, renewed, createMonthly }),
    [offerDealBills, setStage, contacted, addLog, removeLog, markPaid, renewed, createMonthly],
  );
}
