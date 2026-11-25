import { useMemo } from "react";
import { DateCell } from "../../components/DateCell";
import { ASSET_KINDS, type Asset } from "../../domain/types";
import { todayWita } from "../../lib/dates";
import { WINDOW } from "../../lib/summary";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import type { FieldDef } from "../shared/formModel";
import { byDate, byText, CardLine, Money, Muted } from "../shared/helpers";

const FIELDS: FieldDef[] = [
  { key: "client", label: "Klien", kind: "text", required: true },
  { key: "item", label: "Item", kind: "text", placeholder: "contoh.com, nama project Firebase" },
  { key: "kind", label: "Jenis", kind: "select", options: ASSET_KINDS.map((s) => ({ value: s, label: s })) },
  { key: "provider", label: "Provider", kind: "text" },
  { key: "cost", label: "Biaya per tahun", kind: "money" },
  { key: "renewal", label: "Tanggal perpanjangan", kind: "date" },
  { key: "note", label: "Catatan", kind: "textarea" },
];

const sortAssets = (a: Asset, b: Asset) => byDate(a.renewal, b.renewal) || byText(a.client, b.client);

export default function AssetsPage() {
  const today = todayWita();

  const config = useMemo<PageConfig<"assets">>(
    () => ({
      collection: "assets",
      title: "Aset",
      noun: "aset",
      csvName: "aset",
      fields: FIELDS,
      filters: [
        {
          label: "Jenis",
          as: "select",
          options: [
            { value: "semua", label: "Semua jenis", test: () => true },
            ...ASSET_KINDS.map((s) => ({ value: s, label: s, test: (a: Asset) => a.kind === s })),
          ],
        },
      ],
      searchText: (a) => `${a.client} ${a.item} ${a.provider}`,
      sort: sortAssets,
      columns: [
        {
          header: "Item",
          className: "min-w-40",
          cell: (a) => (
            <>
              <p className="break-all font-semibold">{a.item || a.client}</p>
              {a.item && <Muted>{a.client}</Muted>}
            </>
          ),
        },
        { header: "Jenis", cell: (a) => a.kind },
        { header: "Provider", className: "hidden xl:table-cell", cell: (a) => a.provider || <Muted>-</Muted> },
        { header: "Biaya per tahun", cell: (a) => <Money value={a.cost} /> },
        {
          header: "Perpanjangan",
          cell: (a) => <DateCell date={a.renewal} today={today} nearDays={WINDOW.assetRenewal} />,
        },
      ],
      card: (a) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="break-all font-semibold">{a.item || a.client}</p>
            <span className="shrink-0 text-gray-600">{a.kind}</span>
          </div>
          {a.item && <Muted>{a.client}</Muted>}
          {a.provider && <CardLine label="Provider">{a.provider}</CardLine>}
          {a.cost !== null && (
            <CardLine label="Biaya">
              <Money value={a.cost} suffix="/thn" />
            </CardLine>
          )}
          {a.renewal && (
            <CardLine label="Perpanjangan">
              <DateCell date={a.renewal} today={today} nearDays={WINDOW.assetRenewal} />
            </CardLine>
          )}
        </div>
      ),
      drawerTitle: (a) => a.item || a.client,
      csv: [
        { header: "Klien", value: (a) => a.client },
        { header: "Item", value: (a) => a.item },
        { header: "Jenis", value: (a) => a.kind },
        { header: "Provider", value: (a) => a.provider },
        { header: "Biaya per tahun", value: (a) => a.cost },
        { header: "Perpanjangan", value: (a) => a.renewal },
        { header: "Catatan", value: (a) => a.note },
      ],
    }),
    [today],
  );

  return <CollectionPage config={config} />;
}
