import { Drawer } from "../../components/Drawer";
import { useData } from "../../data/DataContext";
import type { CollectionName, Records } from "../../domain/records";
import { closeEdit, NEW_ID, useEditTarget } from "../../lib/route";
import { EditPanel, type FormConfig } from "./EditPanel";
import { useFormConfigs } from "./forms";

/**
 * Satu tempat yang merender panel edit dari URL (`?c=<koleksi>&edit=<id>`),
 * di halaman mana pun. Halaman cukup memanggil openEdit().
 */
export function PanelHost() {
  const target = useEditTarget();
  const data = useData();
  const configs = useFormConfigs();
  if (!target) return null;

  const c: CollectionName = target.collection;
  const config = configs[c] as unknown as FormConfig<CollectionName>;
  const key = `${c}/${target.id}`;

  if (target.id === NEW_ID) return <EditPanel key={key} config={config} record={null} prefill={target.prefill} />;

  const record = (data[c] as Records[CollectionName][]).find((r) => r.id === target.id);
  if (record) return <EditPanel key={key} config={config} record={record} />;
  if (!data.loaded[c]) return null;
  return (
    <Drawer title="Tidak ditemukan" onClose={closeEdit}>
      <p className="text-gray-600">Data ini sudah dihapus atau tautannya salah.</p>
    </Drawer>
  );
}
