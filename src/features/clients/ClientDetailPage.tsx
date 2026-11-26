import { ArrowLeft, MessageSquarePlus, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "../../components/Chip";
import { Button } from "../../components/Button";
import { DateCell } from "../../components/DateCell";
import { DatePicker } from "../../components/DatePicker";
import { EmptyState } from "../../components/EmptyState";
import { inputClass } from "../../components/Field";
import { Select } from "../../components/Select";
import { useAllLoaded, useData } from "../../data/DataContext";
import { useLookup } from "../../data/useLookup";
import { phaseOf } from "../../domain/projectFlow";
import { STAGES, type Asset, type Payment, type Project } from "../../domain/types";
import { contactLabel, waLink } from "../../lib/contact";
import { formatDate, todayWita } from "../../lib/dates";
import { formatRupiah } from "../../lib/money";
import { NEW_ID, openEdit } from "../../lib/route";
import { WINDOW } from "../../lib/summary";
import { PaidButton } from "../panels/forms";
import { useActions } from "../panels/useActions";
import { byDate, LinkButton, Money, Muted, NavLink, PriceText, StageBadge } from "../shared/helpers";

/**
 * Satu layar untuk satu klien (PLAN-KLIEN §4.3): status, sumber, proyek,
 * uang, aset, dan riwayat. Semua edit lewat panel yang sama dengan halaman lain.
 */
export default function ClientDetailPage({ id }: { id: string }) {
  const data = useData();
  const loaded = useAllLoaded();
  const lookup = useLookup();
  const view = lookup.views.get(id);

  if (!loaded) return <p className="py-12 text-center text-gray-500">Memuat...</p>;
  if (!view) {
    return (
      <>
        <BackLink />
        <EmptyState title="Klien tidak ditemukan">Klien ini sudah dihapus atau tautannya salah.</EmptyState>
      </>
    );
  }

  const { client, projects, money } = view;
  const bills = data.payments.filter((p) => p.clientId === id).sort(sortBills);
  const owned = data.assets.filter((a) => a.clientId === id).sort((a, b) => byDate(a.renewal, b.renewal));
  const wa = waLink(client.phone);
  const source = [client.source || "Sumber belum diketahui", client.sourceNote].filter(Boolean).join(", ");

  return (
    <>
      <BackLink />
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <StageBadge stage={view.stage} />
        </div>
        <p className="text-gray-600">
          {source}
          {view.lastContact && `. Terakhir dihubungi ${formatDate(view.lastContact)}`}
        </p>
        {client.note && <p className="whitespace-pre-line text-gray-700">{client.note}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {client.contact && <LinkButton href={client.contact}>{contactLabel(client.contact)}</LinkButton>}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-gray-200 bg-surface px-4 font-semibold hover:bg-gray-50"
            >
              <Phone size={18} aria-hidden />
              Chat WA
            </a>
          )}
          <Button onClick={() => openEdit("clients", id)}>
            <Pencil size={18} aria-hidden />
            Edit klien
          </Button>
        </div>
      </header>

      <section aria-label="Uang" className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total deal" value={formatRupiah(money.deal)} />
        <Stat label="Sudah dibayar" value={formatRupiah(money.paid)} />
        <Stat label="Belum dibayar" value={formatRupiah(money.unpaid)} tone={money.unpaid > 0 ? "near" : undefined} />
        <Stat label="Bulanan" value={money.monthly ? `${formatRupiah(money.monthly)}/bln` : "-"} />
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <Section
            title="Proyek"
            action={
              <Button onClick={() => openEdit("projects", NEW_ID, { clientId: id })}>
                <Plus size={18} aria-hidden />
                Tambah proyek
              </Button>
            }
          >
            {projects.length === 0 ? (
              <EmptyState title="Belum ada proyek" />
            ) : (
              <ul className="space-y-3">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Tagihan"
            action={
              <Button onClick={() => openEdit("payments", NEW_ID, { clientId: id })}>
                <Plus size={18} aria-hidden />
                Tambah tagihan
              </Button>
            }
          >
            {bills.length === 0 ? (
              <EmptyState title="Belum ada tagihan">Tagihan DP dan pelunasan ditawarkan otomatis saat proyek jadi Deal.</EmptyState>
            ) : (
              <List>
                {bills.map((b) => (
                  <BillRow key={b.id} bill={b} />
                ))}
              </List>
            )}
          </Section>

          <Section
            title="Aset"
            action={
              <Button onClick={() => openEdit("assets", NEW_ID, { clientId: id })}>
                <Plus size={18} aria-hidden />
                Tambah aset
              </Button>
            }
          >
            {owned.length === 0 ? (
              <EmptyState title="Belum ada aset">Domain, hosting, atau project Firebase milik klien ini.</EmptyState>
            ) : (
              <List>
                {owned.map((a) => (
                  <AssetRow key={a.id} asset={a} />
                ))}
              </List>
            )}
          </Section>
        </div>

        <Section title="Riwayat">
          <LogPanel clientId={id} />
        </Section>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <NavLink to="/klien" className="mb-4 inline-flex min-h-11 items-center gap-2 text-gray-600 hover:text-gray-900">
      <ArrowLeft size={18} aria-hidden />
      Semua klien
    </NavLink>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "near" }) {
  return (
    <div className="rounded-card border border-gray-200 bg-surface p-4">
      <p className="text-gray-600">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "near" ? "text-near" : ""}`}>{value}</p>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-gray-100 overflow-hidden rounded-card border border-gray-200 bg-surface">{children}</ul>;
}

/** Baris yang bisa diklik (buka panel) dan berisi tombol sendiri; tombol tidak ikut membuka panel. */
function Clickable({ onOpen, className, children }: { onOpen: () => void; className: string; children: ReactNode }) {
  return (
    <li
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {children}
    </li>
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function ProjectCard({ project: p }: { project: Project }) {
  const lookup = useLookup();
  const actions = useActions();
  const today = todayWita();
  const phase = phaseOf(p.stage);
  const service = lookup.service(p.serviceId);
  const chasing = phase === "Prospek" || p.stage === "On hold";

  return (
    <Clickable onOpen={() => openEdit("projects", p.id)} className="rounded-card border border-gray-200 bg-surface p-4 hover:border-gray-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{lookup.projectName(p)}</p>
          <Muted>
            {[service && service.name !== lookup.projectName(p) ? service.name : "", ...p.extras, p.qty && service?.unit ? `${p.qty} ${service.unit}` : ""]
              .filter(Boolean)
              .join(", ")}
          </Muted>
        </div>
        <div className="w-44 shrink-0" onClick={stop} onKeyDown={stop}>
          <Select
            aria-label={`Tahap ${lookup.projectName(p)}`}
            value={p.stage}
            onChange={(v) => actions.setStage(p, v as Project["stage"])}
            options={STAGES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Item label={p.stage === "Live" || phase === "Dikerjakan" || p.stage === "Selesai" ? "Harga deal" : "Harga penawaran"}>
          <PriceText price={p.price} monthly={p.monthly} />
        </Item>
        <Item label="Berikutnya">
          {p.next && <span className="mr-2">{p.next}</span>}
          <DateCell date={p.nextDate} today={today} nearDays={chasing ? WINDOW.contact : WINDOW.work} active={phase !== "Tutup" || p.stage === "On hold"} />
        </Item>
        {p.due && (
          <Item label="Deadline">
            <DateCell date={p.due} today={today} nearDays={WINDOW.work} active={phase === "Dikerjakan"} />
          </Item>
        )}
        {(p.dealAt || p.liveAt) && (
          <Item label="Riwayat">
            {[p.dealAt && `Deal ${formatDate(p.dealAt)}`, p.liveAt && `Live ${formatDate(p.liveAt)}`].filter(Boolean).join(", ")}
          </Item>
        )}
      </dl>
      {(chasing || p.link) && (
        <div className="mt-3 flex flex-wrap gap-2" onClick={stop} onKeyDown={stop}>
          {chasing && (
            <Button onClick={() => actions.contacted(p)}>
              <MessageSquarePlus size={18} aria-hidden />
              Sudah dihubungi, +3 hari
            </Button>
          )}
          {p.link && <LinkButton href={p.link}>Buka link</LinkButton>}
        </div>
      )}
    </Clickable>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Belum lunas dulu (jatuh tempo terdekat), lalu yang lunas (terbaru dulu). */
function sortBills(a: Payment, b: Payment): number {
  const ua = a.status !== "Lunas";
  const ub = b.status !== "Lunas";
  if (ua !== ub) return ua ? -1 : 1;
  return ua ? byDate(a.due, b.due) : byDate(b.paidAt, a.paidAt);
}

function BillRow({ bill: b }: { bill: Payment }) {
  const lookup = useLookup();
  const actions = useActions();
  const unpaid = b.status !== "Lunas";
  const project = lookup.project(b.projectId);
  return (
    <Clickable onOpen={() => openEdit("payments", b.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {b.type}
          {b.item && <span className="font-normal text-gray-600">, {b.item}</span>}
        </p>
        <Muted>{project ? lookup.projectName(project) : "Tanpa proyek"}</Muted>
      </div>
      <Money value={b.amount} />
      <div className="flex items-center gap-2">
        {unpaid ? (
          <DateCell date={b.due} today={todayWita()} nearDays={WINDOW.payment} />
        ) : (
          <Badge tone="ok">Lunas{b.paidAt ? ` ${formatDate(b.paidAt)}` : ""}</Badge>
        )}
        {unpaid && (
          <span onClick={stop} onKeyDown={stop}>
            <PaidButton compact onClick={() => actions.markPaid(b)} />
          </span>
        )}
      </div>
    </Clickable>
  );
}

function AssetRow({ asset: a }: { asset: Asset }) {
  return (
    <Clickable onOpen={() => openEdit("assets", a.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="break-all font-semibold">{a.item}</p>
        <Muted>{[a.kind, a.provider].filter(Boolean).join(", ")}</Muted>
      </div>
      {a.cost !== null && <Money value={a.cost} suffix="/thn" />}
      <DateCell date={a.renewal} today={todayWita()} nearDays={WINDOW.renewal} />
    </Clickable>
  );
}

function LogPanel({ clientId }: { clientId: string }) {
  const lookup = useLookup();
  const actions = useActions();
  const client = lookup.client(clientId);
  const [date, setDate] = useState(todayWita());
  const [text, setText] = useState("");
  if (!client) return null;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    actions.addLog(client, { date: date || todayWita(), text: t.slice(0, 500) });
    setText("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-2 rounded-card border border-gray-200 bg-surface p-4">
        <label className="block">
          <span className="sr-only">Catatan</span>
          <input
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Contoh: kirim harga lewat DM"
            maxLength={500}
          />
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <DatePicker value={date} onChange={setDate} aria-label="Tanggal catatan" />
          </div>
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            Tambah
          </Button>
        </div>
      </form>
      {client.log.length === 0 ? (
        <p className="text-gray-500">Belum ada catatan. "Sudah dihubungi" di proyek juga tercatat di sini.</p>
      ) : (
        <ol className="space-y-1">
          {client.log.map((e, i) => (
            <li key={`${e.date}-${i}`} className="flex items-start gap-3 rounded-card px-1 py-1 hover:bg-gray-50">
              <span className="w-24 shrink-0 whitespace-nowrap pt-2.5 text-gray-500">{formatDate(e.date)}</span>
              <span className="min-w-0 flex-1 break-words pt-2.5">{e.text}</span>
              <button
                type="button"
                onClick={() => void actions.removeLog(client, i)}
                aria-label={`Hapus catatan ${e.text}`}
                title="Hapus catatan"
                className="flex size-11 shrink-0 items-center justify-center rounded-card text-gray-400 hover:bg-gray-100 hover:text-late"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
