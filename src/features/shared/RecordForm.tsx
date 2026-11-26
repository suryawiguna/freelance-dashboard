import { ChipGroup } from "../../components/Chip";
import { DatePicker } from "../../components/DatePicker";
import { Field, inputClass } from "../../components/Field";
import { Select } from "../../components/Select";
import { cn } from "../../lib/cn";
import { parseRupiah } from "../../lib/money";
import { formSections, moneyInput, type FieldDef, type FormValues } from "./formModel";

/**
 * Merender FieldDef jadi input, dikelompokkan per bagian berjudul dan dua
 * kolom untuk field `half`. Stateless: nilai dan pesan salah dari luar.
 */
export function RecordForm({
  fields,
  values,
  errors,
  onChange,
  isNew = false,
}: {
  fields: readonly FieldDef[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  isNew?: boolean;
}) {
  return (
    <div className="divide-y divide-gray-200">
      {formSections(fields, isNew).map((s) => (
        <section key={s.title} aria-label={s.title || undefined} className="py-5 first:pt-0 last:pb-0">
          {s.title && <h3 className="mb-4 text-lg font-bold text-gray-900">{s.title}</h3>}
          <div className="grid items-start gap-x-3 gap-y-4 sm:grid-cols-2">
            {s.fields.map((f) => (
              <div key={f.key} className={cn(!f.half && "sm:col-span-2")}>
                <Field label={f.label} hint={f.hint} error={errors[f.key]} required={f.required}>
                  {(a11y) => (
                    <Input def={f} value={values[f.key] ?? ""} onChange={(v) => onChange(f.key, v)} a11y={a11y} />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Input({
  def,
  value,
  onChange,
  a11y,
}: {
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
  a11y: { id: string; "aria-invalid": boolean; "aria-describedby"?: string };
}) {
  const common = { ...a11y, name: def.key, className: inputClass, placeholder: def.placeholder };
  switch (def.kind) {
    case "textarea":
      return <textarea {...common} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "choice":
      return (
        <ChipGroup
          label={def.label}
          labelledBy={`${a11y.id}-label`}
          describedBy={a11y["aria-describedby"]}
          options={def.options ?? []}
          value={value}
          onChange={onChange}
        />
      );
    case "select":
      return <Select {...a11y} value={value} onChange={onChange} options={def.options ?? []} />;
    case "date":
      return <DatePicker {...a11y} value={value} onChange={onChange} />;
    case "contact":
      return <input {...common} type="text" inputMode="email" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return (
        <input
          {...common}
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "count":
      return (
        <input {...common} type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
      );
    case "money":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">Rp</span>
          <input
            {...common}
            className={`${inputClass} pl-10`}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              const n = parseRupiah(value);
              if (typeof n === "number") onChange(moneyInput(n));
            }}
          />
        </div>
      );
    default:
      return <input {...common} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}
