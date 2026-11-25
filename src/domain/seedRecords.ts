/** Data Lampiran A (scripts/seed-data.json) dalam bentuk penuh. Dipakai tes. */
import seed from "../../scripts/seed-data.json";
import { normalize, type CollectionName, type Records } from "./records";

type Raw = Record<string, Array<{ id: string } & Record<string, unknown>>>;

export function seedRecords(): { [C in CollectionName]: Records[C][] } {
  const raw = seed as unknown as Raw;
  const of = <C extends CollectionName>(c: C) => (raw[c] ?? []).map(({ id, ...d }) => normalize(c, id, d));
  return { leads: of("leads"), projects: of("projects"), payments: of("payments"), assets: of("assets") };
}
