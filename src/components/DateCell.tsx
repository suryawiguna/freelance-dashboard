import { dueStatus, formatDate } from "../lib/dates";
import { Badge } from "./Chip";

/** Tanggal + status teks ("Lewat 2 hari") berwarna. Kosong = "-". */
export function DateCell({ date, today, nearDays, active = true }: {
  date: string;
  today: string;
  nearDays: number;
  /** False untuk item yang sudah beres (lunas, selesai): tanpa status. */
  active?: boolean;
}) {
  if (!date) return <span className="text-gray-400">-</span>;
  const status = active ? dueStatus(date, today, nearDays) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="whitespace-nowrap">{formatDate(date)}</span>
      {status && <Badge tone={status.tone}>{status.label}</Badge>}
    </span>
  );
}
