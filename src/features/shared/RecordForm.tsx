import { DatePicker } from "../../components/DatePicker";
import { Field, inputClass } from "../../components/Field";
import { Select } from "../../components/Select";
import { parseRupiah } from "../../lib/money";
import { moneyInput, type FieldDef, type FormValues } from "./formModel";

/** Merender FieldDef jadi input. Stateless: nilai dan pesan salah dari luar. */
export function RecordForm({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: readonly FieldDef[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]} required={f.required}>
          {(a11y) => <Input def={f} value={values[f.key] ?? ""} onChange={(v) => onChange(f.key, v)} a11y={a11y} />}
        </Field>
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
