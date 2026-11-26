import { useMemo } from "react";
import { DateCell } from "../../components/DateCell";
import { useLookup } from "../../data/useLookup";
import { SOURCES, type Client, type Phase } from "../../domain/types";
import { attentionDate } from "../../lib/clients";
import { contactLabel } from "../../lib/contact";
import { formatDate, todayWita } from "../../lib/dates";
import { clientPath, navigate } from "../../lib/route";
import { WINDOW } from "../../lib/summary";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import { byDate, byText, CardLine, LinkButton, Muted, PriceText, StageBadge } from "../shared/helpers";

/**
 * Daftar klien yang langsung menjawab: statusnya, dari mana, proyeknya apa,
 * harganya berapa, dan langkah berikutnya (PLAN-KLIEN §4.2). Klik = detail klien.
 */
export default function ClientsPage() {
  const lookup = useLookup();
  const today = todayWita();

  const config = useMemo<PageConfig<"clients">>(() => {
    const view = (c: Client) => lookup.views.get(c.id);
    const phaseIs = (phase: Phase) => (c: Client) => view(c)?.phase === phase;
    const projectLabel = (c: Client) => {
      const v = view(c);
      if (!v?.primary) return "";
      return `${lookup.projectName(v.primary)}${v.otherActive ? ` +${v.otherActive} proyek` : ""}`;
    };
    const nextOf = (c: Client) => (view(c)?.primary ? attentionDate(view(c)!.primary!) : "");
    const closed = (c: Client) => view(c)?.phase === "Tutup";
    const sourceText = (c: Client) => [c.source, c.sourceNote].filter(Boolean).join(", ");

    const Next = ({ c }: { c: Client }) => {
      const p = view(c)?.primary;
      if (!p) return <span className="text-gray-500">-</span>;
      return (
        <>
          {p.next && <span className="block">{p.next}</span>}
          <DateCell date={nextOf(c)} today={today} nearDays={WINDOW.contact} active={!closed(c) || p.stage === "On hold"} />
        </>
      );
    };

    return {
      collection: "clients",
      title: "Klien",
      noun: "klien",
      csvName: "klien",
      open: (c) => navigate(clientPath(c.id)),
      filters: [
        {
          label: "Fase",
          initial: "aktif",
          options: [
            { value: "aktif", label: "Aktif", test: (c) => !closed(c) },
            { value: "Prospek", label: "Prospek", test: phaseIs("Prospek") },
            { value: "Dikerjakan", label: "Dikerjakan", test: phaseIs("Dikerjakan") },
            { value: "Live", label: "Live", test: phaseIs("Live") },
            { value: "Tutup", label: "Tutup", test: closed },
          ],
        },
        {
          label: "Sumber",
          as: "select",
          options: [
            { value: "semua", label: "Semua sumber", test: () => true },
            ...SOURCES.map((s) => ({ value: s, label: s, test: (c: Client) => c.source === s })),
            { value: "", label: "Belum diketahui", test: (c: Client) => c.source === "" },
          ],
        },
      ],
      searchText: (c) => [c.name, c.note, c.sourceNote, ...(view(c)?.projects.map((p) => lookup.projectName(p)) ?? [])].join(" "),
      sort: (a, b) => Number(closed(a)) - Number(closed(b)) || byDate(nextOf(a), nextOf(b)) || byText(a.name, b.name),
      columns: [
        {
          header: "Klien",
          className: "min-w-40",
          cell: (c) => (
            <>
              <p className="font-semibold">{c.name}</p>
              <Muted>{sourceText(c) || "Sumber belum diketahui"}</Muted>
            </>
          ),
        },
        { header: "Proyek", cell: (c) => projectLabel(c) || <Muted>-</Muted> },
        { header: "Tahap", cell: (c) => <StageBadge stage={view(c)?.stage ?? null} /> },
        {
          header: "Harga",
          cell: (c) => {
            const p = view(c)?.primary;
            return <PriceText price={p?.price ?? null} monthly={p?.monthly ?? null} />;
          },
        },
        { header: "Berikutnya", className: "min-w-44", cell: (c) => <Next c={c} /> },
      ],
      card: (c) => {
        const p = view(c)?.primary;
        return (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{c.name}</p>
              <StageBadge stage={view(c)?.stage ?? null} />
            </div>
            <Muted>{[projectLabel(c), sourceText(c)].filter(Boolean).join(", ")}</Muted>
            {p && (p.price !== null || p.monthly !== null) && (
              <CardLine label="Harga">
                <PriceText price={p.price} monthly={p.monthly} />
              </CardLine>
            )}
            {p && (p.next || nextOf(c)) && (
              <CardLine label="Berikutnya">
                <Next c={c} />
              </CardLine>
            )}
          </div>
        );
      },
      rowActions: (c, { compact }) =>
        c.contact ? (
          <LinkButton href={c.contact} iconOnly={compact}>
            {contactLabel(c.contact)}
          </LinkButton>
        ) : null,
      csv: [
        { header: "Klien", value: (c) => c.name },
        { header: "Sumber", value: (c) => c.source },
        { header: "Detail sumber", value: (c) => c.sourceNote },
        { header: "Kontak", value: (c) => c.contact },
        { header: "WA", value: (c) => c.phone },
        { header: "Proyek utama", value: (c) => projectLabel(c) },
        { header: "Tahap", value: (c) => view(c)?.stage ?? "" },
        { header: "Harga", value: (c) => view(c)?.primary?.price },
        { header: "Biaya bulanan", value: (c) => view(c)?.primary?.monthly },
        { header: "Langkah berikutnya", value: (c) => view(c)?.primary?.next },
        { header: "Tanggal berikutnya", value: (c) => nextOf(c) },
        { header: "Total deal", value: (c) => view(c)?.money.deal },
        { header: "Sudah dibayar", value: (c) => view(c)?.money.paid },
        { header: "Belum dibayar", value: (c) => view(c)?.money.unpaid },
        { header: "Terakhir dihubungi", value: (c) => (view(c)?.lastContact ? formatDate(view(c)!.lastContact) : "") },
        { header: "Catatan", value: (c) => c.note },
      ],
    };
  }, [lookup, today]);

  return <CollectionPage config={config} />;
}
