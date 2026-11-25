import { useMemo } from "react";
import { Button } from "../../components/Button";
import { Badge, type Tone } from "../../components/Chip";
import { DateCell } from "../../components/DateCell";
import { useData } from "../../data/DataContext";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "../../domain/types";
import { todayWita } from "../../lib/dates";
import { openEdit } from "../../lib/route";
import { WINDOW } from "../../lib/summary";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import type { FieldDef } from "../shared/formModel";
import { byDate, byText, CardLine, LinkButton, Money, Muted } from "../shared/helpers";

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  "Belum mulai": "neutral",
  Dikerjakan: "accent",
  Revisi: "near",
  Live: "ok",
  Maintenance: "ok",
  Selesai: "neutral",
};

const IN_PROGRESS = new Set<ProjectStatus>(["Belum mulai", "Dikerjakan", "Revisi"]);

const FIELDS: FieldDef[] = [
  { key: "client", label: "Klien", kind: "text", required: true },
  { key: "name", label: "Nama proyek", kind: "text" },
  { key: "status", label: "Status", kind: "select", options: PROJECT_STATUSES.map((s) => ({ value: s, label: s })) },
  { key: "monthly", label: "Biaya langganan bulanan", kind: "money" },
  { key: "due", label: "Deadline", kind: "date" },
  { key: "link", label: "Link proyek atau demo", kind: "url", placeholder: "https://" },
  { key: "next", label: "Langkah berikutnya", kind: "text" },
];

const sortProjects = (a: Project, b: Project) =>
  PROJECT_STATUSES.indexOf(a.status) - PROJECT_STATUSES.indexOf(b.status) ||
  byDate(a.due, b.due) ||
  byText(a.client, b.client);

export default function ProjectsPage() {
  const { leads } = useData();
  const today = todayWita();

  const config = useMemo<PageConfig<"projects">>(
    () => ({
      collection: "projects",
      title: "Proyek",
      noun: "proyek",
      csvName: "proyek",
      fields: FIELDS,
      filters: [
        {
          // Enam status digabung jadi tiga kelompok; status persisnya ada di badge.
          label: "Status",
          options: [
            { value: "semua", label: "Semua", test: () => true },
            { value: "aktif", label: "Aktif", test: (p: Project) => IN_PROGRESS.has(p.status) },
            { value: "live", label: "Live", test: (p: Project) => p.status === "Live" || p.status === "Maintenance" },
            { value: "selesai", label: "Selesai", test: (p: Project) => p.status === "Selesai" },
          ],
        },
      ],
      searchText: (p) => `${p.client} ${p.name}`,
      sort: sortProjects,
      columns: [
        {
          header: "Proyek",
          className: "min-w-40",
          cell: (p) => (
            <>
              <p className="font-semibold">{p.name || p.client}</p>
              {p.name && <Muted>{p.client}</Muted>}
            </>
          ),
        },
        { header: "Status", cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge> },
        { header: "Bulanan", cell: (p) => <Money value={p.monthly} /> },
        {
          header: "Deadline",
          cell: (p) => (
            <DateCell date={p.due} today={today} nearDays={WINDOW.projectDue} active={IN_PROGRESS.has(p.status)} />
          ),
        },
        { header: "Langkah berikutnya", className: "hidden lg:table-cell", cell: (p) => p.next || <Muted>-</Muted> },
      ],
      card: (p) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{p.name || p.client}</p>
            <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
          </div>
          {p.name && <Muted>{p.client}</Muted>}
          {p.monthly !== null && (
            <CardLine label="Bulanan">
              <Money value={p.monthly} />
            </CardLine>
          )}
          {p.due && (
            <CardLine label="Deadline">
              <DateCell date={p.due} today={today} nearDays={WINDOW.projectDue} active={IN_PROGRESS.has(p.status)} />
            </CardLine>
          )}
          {p.next && <CardLine label="Berikutnya">{p.next}</CardLine>}
        </div>
      ),
      panelExtras: ({ record }) => {
        if (!record) return null;
        const lead = record.leadId ? leads.find((l) => l.id === record.leadId) : undefined;
        if (!record.link && !lead) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {record.link && <LinkButton href={record.link}>Buka link</LinkButton>}
            {lead && <Button onClick={() => openEdit(lead.id, "/lead")}>Lihat lead asal</Button>}
          </div>
        );
      },
      drawerTitle: (p) => p.name || p.client,
      csv: [
        { header: "Klien", value: (p) => p.client },
        { header: "Nama proyek", value: (p) => p.name },
        { header: "Status", value: (p) => p.status },
        { header: "Biaya bulanan", value: (p) => p.monthly },
        { header: "Deadline", value: (p) => p.due },
        { header: "Link", value: (p) => p.link },
        { header: "Langkah berikutnya", value: (p) => p.next },
        { header: "Lead asal", value: (p) => p.leadId },
      ],
    }),
    [leads, today],
  );

  return <CollectionPage config={config} />;
}
