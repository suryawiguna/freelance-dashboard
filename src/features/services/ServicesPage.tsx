import { useMemo } from "react";
import { Badge } from "../../components/Chip";
import { useData } from "../../data/DataContext";
import type { Service } from "../../domain/types";
import { formatRupiah } from "../../lib/money";
import { CollectionPage, type PageConfig } from "../shared/CollectionPage";
import { byText, CardLine, Money, Muted } from "../shared/helpers";

/**
 * Jasa dan harga patokan (PLAN-KLIEN §4.5). Harga di proyek terisi dari sini;
 * juga contekan saat membalas DM.
 */
export default function ServicesPage() {
  const { projects } = useData();

  const config = useMemo<PageConfig<"services">>(() => {
    const used = (s: Service) => projects.filter((p) => p.serviceId === s.id).length;
    const extrasText = (s: Service) => s.extras.map((x) => `${x.name} +${formatRupiah(x.price)}`).join(", ");
    const Setup = ({ s }: { s: Service }) => (
      <>
        <Money value={s.setup} />
        {s.setupNote && <Muted>{s.setupNote}</Muted>}
      </>
    );
    const Monthly = ({ s }: { s: Service }) =>
      s.monthly === null ? <Muted>-</Muted> : <Money value={s.monthly} suffix={s.unit ? `/bln per ${s.unit}` : "/bln"} />;
    const dp = (s: Service) => (s.dpPercent >= 100 ? "Penuh di depan" : s.dpPercent <= 0 ? "Tanpa DP" : `DP ${s.dpPercent}%`);

    return {
      collection: "services",
      title: "Jasa",
      noun: "jasa",
      csvName: "jasa",
      intro: <p className="-mt-4 mb-6 text-gray-600">Harga patokan. Harga di proyek terisi dari sini, lalu boleh diubah per klien.</p>,
      filters: [
        {
          label: "Status",
          options: [
            { value: "aktif", label: "Ditawarkan", test: (s: Service) => s.active },
            { value: "nonaktif", label: "Tidak ditawarkan", test: (s: Service) => !s.active },
            { value: "semua", label: "Semua", test: () => true },
          ],
        },
      ],
      searchText: (s) => `${s.name} ${s.includes} ${extrasText(s)}`,
      sort: (a, b) => Number(b.active) - Number(a.active) || byText(a.name, b.name),
      columns: [
        {
          header: "Jasa",
          className: "min-w-40",
          cell: (s) => (
            <>
              <p className="font-semibold">{s.name}</p>
              <Muted>{s.active ? `${used(s)} proyek` : "Tidak ditawarkan"}</Muted>
            </>
          ),
        },
        { header: "Setup", cell: (s) => <Setup s={s} /> },
        { header: "Bulanan", cell: (s) => <Monthly s={s} /> },
        { header: "Tambahan", className: "hidden xl:table-cell", cell: (s) => extrasText(s) || <Muted>-</Muted> },
        { header: "Pembayaran", cell: (s) => <Badge>{dp(s)}</Badge> },
      ],
      card: (s) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{s.name}</p>
            <Badge>{dp(s)}</Badge>
          </div>
          <CardLine label="Setup">
            <Money value={s.setup} />
            {s.setupNote && <span className="text-gray-500">{s.setupNote}</span>}
          </CardLine>
          {s.monthly !== null && (
            <CardLine label="Bulanan">
              <Monthly s={s} />
            </CardLine>
          )}
          {s.extras.length > 0 && <CardLine label="Tambahan">{extrasText(s)}</CardLine>}
          {!s.active && <Muted>Tidak ditawarkan</Muted>}
        </div>
      ),
      csv: [
        { header: "Jasa", value: (s) => s.name },
        { header: "Setup", value: (s) => s.setup },
        { header: "Keterangan harga", value: (s) => s.setupNote },
        { header: "Bulanan", value: (s) => s.monthly },
        { header: "Per satuan", value: (s) => s.unit },
        { header: "DP (%)", value: (s) => s.dpPercent },
        { header: "Tambahan", value: (s) => extrasText(s) },
        { header: "Isi paket", value: (s) => s.includes },
        { header: "Ditawarkan", value: (s) => (s.active ? "Ya" : "Tidak") },
      ],
    };
  }, [projects]);

  return <CollectionPage config={config} />;
}
