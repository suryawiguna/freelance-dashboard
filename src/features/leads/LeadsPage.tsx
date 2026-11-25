import { CalendarPlus, FolderPlus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../components/Button";
import { Badge, type Tone } from "../../components/Chip";
import { DateCell } from "../../components/DateCell";
import { useToast } from "../../components/Toast";
import { useData } from "../../data/DataContext";
import { create, update } from "../../data/repo";
import { bumpFollowUp, monthlyForBranches, projectFromLead } from "../../domain/leadActions";
import { LEAD_SOURCES, LEAD_STAGES, type Lead, type LeadStage } from "../../domain/types";
import { formatDate, todayWita } from "../../lib/dates";
import { openEdit } from "../../lib/route";
import { isOpenLead, WINDOW } from "../../lib/summary";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import { moneyInput, type FieldDef, type FormValues } from "../shared/formModel";
import { byDate, byText, CardLine, LinkButton, Money, Muted } from "../shared/helpers";

const STAGE_TONE: Record<LeadStage, Tone> = {
  Baru: "accent",
  "Kirim harga": "accent",
  Nego: "accent",
  Deal: "ok",
  "On hold": "neutral",
  Tutup: "neutral",
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "Nama", kind: "text", required: true },
  { key: "service", label: "Layanan", kind: "text", placeholder: "Kasir (2 cabang)" },
  {
    key: "source",
    label: "Sumber",
    kind: "select",
    options: [{ value: "", label: "Belum diketahui" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))],
  },
  {
    key: "contact",
    label: "Kontak",
    kind: "url",
    placeholder: "https://www.threads.com/messages/t/...",
    hint: "Link DM Threads atau kontak lain, diawali https://",
  },
  { key: "stage", label: "Tahap", kind: "select", options: LEAD_STAGES.map((s) => ({ value: s, label: s })) },
  { key: "value", label: "Nilai setup", kind: "money" },
  {
    key: "branches",
    label: "Jumlah cabang",
    kind: "count",
    hint: "Untuk kasir. Biaya bulanan terisi otomatis Rp145.000 per cabang.",
  },
  { key: "monthly", label: "Biaya bulanan", kind: "money" },
  { key: "followUp", label: "Follow up berikutnya", kind: "date" },
  { key: "next", label: "Langkah berikutnya", kind: "text" },
  { key: "note", label: "Catatan", kind: "textarea" },
];

/** Biaya bulanan ikut jumlah cabang, selama belum diubah manual. */
function derive(key: string, next: FormValues, prev: FormValues): FormValues {
  if (key !== "branches") return next;
  const auto = (b: string) => {
    const n = /^\d+$/.test(b.trim()) ? monthlyForBranches(Number(b)) : null;
    return n === null ? "" : moneyInput(n);
  };
  const untouched = prev.monthly === "" || prev.monthly === auto(prev.branches);
  return untouched ? { ...next, monthly: auto(next.branches) } : next;
}

function sortLeads(a: Lead, b: Lead): number {
  const oa = isOpenLead(a) ? 0 : 1;
  const ob = isOpenLead(b) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  if (oa === 0) return byDate(a.followUp, b.followUp) || byText(a.name, b.name);
  return LEAD_STAGES.indexOf(a.stage) - LEAD_STAGES.indexOf(b.stage) || byText(a.name, b.name);
}

export default function LeadsPage() {
  const toast = useToast();
  const { projects } = useData();
  const today = todayWita();

  const bump = (lead: Lead, setValue?: (k: string, v: string) => void, current = lead.followUp) => {
    const next = bumpFollowUp(current, today);
    setValue?.("followUp", next);
    update("leads", lead.id, { followUp: next }).catch(() => toast("Gagal menggeser follow up.", "error"));
    toast(`Follow up ${lead.name} digeser ke ${formatDate(next)}.`);
  };

  const config = useMemo<PageConfig<"leads">>(
    () => ({
      collection: "leads",
      title: "Lead",
      noun: "lead",
      csvName: "lead",
      fields: FIELDS,
      derive,
      filters: [
        {
          label: "Tahap",
          options: [
            { value: "semua", label: "Semua", test: () => true },
            { value: "terbuka", label: "Terbuka", test: isOpenLead },
            ...LEAD_STAGES.map((s) => ({ value: s, label: s, test: (l: Lead) => l.stage === s })),
          ],
        },
        {
          label: "Sumber",
          options: [
            { value: "semua", label: "Semua sumber", test: () => true },
            ...LEAD_SOURCES.map((s) => ({ value: s, label: s, test: (l: Lead) => l.source === s })),
            { value: "", label: "Belum diketahui", test: (l: Lead) => l.source === "" },
          ],
        },
      ],
      searchText: (l) => `${l.name} ${l.service}`,
      sort: sortLeads,
      columns: [
        {
          header: "Nama",
          className: "min-w-40",
          cell: (l) => (
            <>
              <p className="font-semibold">{l.name}</p>
              <Muted>{l.service}</Muted>
            </>
          ),
        },
        { header: "Tahap", cell: (l) => <Badge tone={STAGE_TONE[l.stage]}>{l.stage}</Badge> },
        {
          header: "Nilai",
          cell: (l) => (
            <>
              <Money value={l.value} />
              {l.monthly !== null && <Muted>+{<Money value={l.monthly} suffix="/bln" />}</Muted>}
            </>
          ),
        },
        {
          header: "Follow up",
          cell: (l) => (
            <DateCell date={l.followUp} today={today} nearDays={WINDOW.leadFollowUp} active={isOpenLead(l)} />
          ),
        },
        { header: "Langkah berikutnya", className: "hidden lg:table-cell", cell: (l) => l.next || <Muted>-</Muted> },
      ],
      card: (l) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{l.name}</p>
            <Badge tone={STAGE_TONE[l.stage]}>{l.stage}</Badge>
          </div>
          <Muted>{l.service}</Muted>
          {l.value !== null && (
            <CardLine label="Nilai">
              <Money value={l.value} />
              {l.monthly !== null && (
                <>
                  {" + "}
                  <Money value={l.monthly} suffix="/bln" />
                </>
              )}
            </CardLine>
          )}
          {l.followUp && (
            <CardLine label="Follow up">
              <DateCell date={l.followUp} today={today} nearDays={WINDOW.leadFollowUp} active={isOpenLead(l)} />
            </CardLine>
          )}
          {l.next && <CardLine label="Berikutnya">{l.next}</CardLine>}
        </div>
      ),
      rowActions: (l) => (
        <>
          {l.contact && <LinkButton href={l.contact}>Buka DM</LinkButton>}
          {isOpenLead(l) && (
            <Button onClick={() => bump(l)} aria-label={`Follow up ${l.name} tambah 3 hari`}>
              <CalendarPlus size={18} aria-hidden />
              +3 hari
            </Button>
          )}
        </>
      ),
      panelExtras: ({ record, values, setValue, saveNow }) => {
        const linked = record ? projects.find((p) => p.leadId === record.id) : undefined;
        const toProject = () => {
          const saved = saveNow();
          if (!saved) return;
          const { id, promise } = create("projects", projectFromLead({ id: saved.id, ...saved.draft }));
          promise.catch(() => toast("Gagal membuat proyek.", "error"));
          toast("Proyek dibuat dari lead ini.");
          openEdit(id, "/proyek");
        };
        const contact = /^https:\/\/\S+$/.test(values.contact ?? "") ? values.contact : "";
        const showProject = values.stage === "Deal";
        if (!contact && !record && !showProject) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {contact && <LinkButton href={contact}>Buka DM</LinkButton>}
            {record && (
              <Button onClick={() => bump(record, setValue, values.followUp)}>
                <CalendarPlus size={18} aria-hidden />
                Follow up +3 hari
              </Button>
            )}
            {showProject &&
              (linked ? (
                <Button onClick={() => openEdit(linked.id, "/proyek")}>
                  Lihat proyek
                </Button>
              ) : (
                <Button variant="primary" onClick={toProject}>
                  <FolderPlus size={18} aria-hidden />
                  Jadikan proyek
                </Button>
              ))}
          </div>
        );
      },
      drawerTitle: (l) => l.name,
      csv: [
        { header: "Nama", value: (l) => l.name },
        { header: "Layanan", value: (l) => l.service },
        { header: "Sumber", value: (l) => l.source },
        { header: "Kontak", value: (l) => l.contact },
        { header: "Tahap", value: (l) => l.stage },
        { header: "Nilai setup", value: (l) => l.value },
        { header: "Biaya bulanan", value: (l) => l.monthly },
        { header: "Jumlah cabang", value: (l) => l.branches },
        { header: "Follow up", value: (l) => l.followUp },
        { header: "Langkah berikutnya", value: (l) => l.next },
        { header: "Catatan", value: (l) => l.note },
      ],
    }),
    // bump dan toast stabil cukup; projects dan today memang memicu ulang.
    [projects, today, toast],
  );

  return <CollectionPage config={config} />;
}
