import { Copy, Pencil } from "lucide-react";
import { Children, isValidElement, useMemo, useRef, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../components/Button";
import { useConfirm } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { inputClass } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../components/Toast";
import { useData } from "../../data/DataContext";
import { saveGuide } from "../../data/repo";
import { GUIDE_MAX } from "../../domain/types";
import { parseTemplates } from "../../domain/templates";
import { copyText } from "../../lib/clipboard";
import { cn } from "../../lib/cn";

/** Teks polos dari children React (untuk id judul). */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : ""))
    .join("");
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Kutipan = template pesan: diberi tombol Salin. */
function Quote({ children }: { children?: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const copy = async () => {
    if (await copyText(body.current?.innerText.trim() ?? "")) toast("Disalin.");
    else toast("Gagal menyalin.", "error");
  };
  return (
    <blockquote className="my-3 flex items-start gap-2 rounded-card border-l-4 border-accent bg-gray-50 py-1 pl-4 pr-1">
      <div ref={body} className="min-w-0 flex-1 [&>p]:my-2">
        {children}
      </div>
      <Button icon variant="ghost" aria-label="Salin kutipan" title="Salin" onClick={() => void copy()}>
        <Copy size={18} aria-hidden />
      </Button>
    </blockquote>
  );
}

const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mb-3 mt-10 text-2xl font-bold first:mt-0">{children}</h2>,
  h2: ({ children }) => (
    <h3 id={slug(textOf(children))} className="mb-3 mt-10 scroll-mt-6 border-b border-gray-200 pb-2 text-lg font-bold first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => <h4 className="mb-2 mt-6 font-bold">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-2 mt-4 font-semibold">{children}</h5>,
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children, className }) => (
    <ul className={cn("my-3 space-y-1 pl-6", className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc")}>
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&>input]:mr-2 [&>input]:accent-accent">{children}</li>,
  blockquote: ({ children }) => <Quote>{children}</Quote>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  hr: () => <hr className="my-8 border-gray-200" />,
  code: ({ children }) => <code className="rounded bg-gray-100 px-1 font-mono">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-card border border-gray-200 bg-gray-50 p-3 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-card border border-gray-200">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-gray-200 bg-gray-50 px-3 py-2 align-bottom font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-gray-100 px-3 py-2 align-top">{children}</td>,
};

/** Judul bagian (`## ...`) untuk daftar isi. */
function sections(md: string): { id: string; title: string }[] {
  let inCode = false;
  const out: { id: string; title: string }[] = [];
  for (const line of md.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) inCode = !inCode;
    const m = !inCode && /^##\s+(.+?)\s*#*$/.exec(line);
    if (m) {
      const title = m[1].replace(/[*_`]/g, "");
      out.push({ id: slug(title), title });
    }
  }
  return out;
}

export default function GuidePage() {
  const { guide } = useData();
  const toast = useToast();
  const ask = useConfirm();
  const [draft, setDraft] = useState<string | null>(null);

  const body = guide?.body ?? "";
  const toc = useMemo(() => sections(body), [body]);
  const templateCount = useMemo(() => parseTemplates(body).length, [body]);

  if (guide === undefined) return <p className="py-12 text-center text-gray-500">Memuat...</p>;

  const editing = draft !== null;
  const dirty = editing && draft !== body;
  const tooLong = editing && draft.length > GUIDE_MAX;

  const save = () => {
    if (draft === null || tooLong) return;
    saveGuide(draft, guide !== null).catch((e) => {
      console.error(e);
      toast("Gagal menyimpan panduan. Coba lagi.", "error");
    });
    setDraft(null);
    toast("Panduan disimpan.");
  };

  const cancel = async () => {
    if (dirty) {
      const ok = await ask({
        title: "Buang perubahan?",
        body: "Perubahan yang belum disimpan akan hilang.",
        confirmLabel: "Buang",
        tone: "danger",
      });
      if (!ok) return;
    }
    setDraft(null);
  };

  if (editing) {
    return (
      <>
        <PageHeader
          title="Edit panduan"
          actions={
            <div className="flex gap-2">
              <Button onClick={() => void cancel()}>Batal</Button>
              <Button variant="primary" onClick={save} disabled={tooLong}>
                Simpan
              </Button>
            </div>
          }
        />
        <label htmlFor="guide-body" className="sr-only">
          Isi panduan
        </label>
        <textarea
          id="guide-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={tooLong}
          aria-describedby="guide-hint"
          spellCheck={false}
          className={cn(inputClass, "min-h-[70dvh] font-mono leading-relaxed")}
        />
        <p id="guide-hint" className={cn("mt-2", tooLong ? "text-late" : "text-gray-500")}>
          {tooLong
            ? `Terlalu panjang: ${draft.length.toLocaleString("id-ID")} dari ${GUIDE_MAX.toLocaleString("id-ID")} karakter.`
            : "Format Markdown. Template pesan: satu baris tebal sebagai judul (**Follow-up H+3:**), lalu kutipan (> ...) sebagai isi. [link] diisi link proyek saat disalin."}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Panduan"
        actions={
          guide && (
            <Button onClick={() => setDraft(body)}>
              <Pencil size={18} aria-hidden />
              Edit
            </Button>
          )
        }
      />
      {!guide || !body.trim() ? (
        <EmptyState title="Belum ada panduan">
          Tulis SOP kerja di sini: alur lead, paket harga, aturan diskon, dan template pesan.
          <div>
            <Button variant="primary" className="mt-4" onClick={() => setDraft(body)}>
              Tulis panduan
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
          {toc.length > 0 && (
            <nav aria-label="Daftar isi" className="mb-8 lg:mb-0">
              <div className="lg:sticky lg:top-10">
                <p className="mb-2 font-semibold text-gray-600">Daftar isi</p>
                {/* HP: satu baris chip yang bisa digeser; desktop: daftar di samping. */}
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0">
                  {toc.map((s) => (
                    <li key={s.id} className="shrink-0 lg:shrink">
                      <a
                        href={`#${s.id}`}
                        className="inline-flex min-h-11 items-center whitespace-nowrap rounded-card border border-gray-200 px-3 text-gray-700 hover:bg-gray-100 lg:min-h-9 lg:whitespace-normal lg:border-0 lg:px-2"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
                {templateCount > 0 && (
                  <p className="mt-4 hidden text-gray-500 lg:block">
                    {templateCount} template pesan bisa disalin dari halaman klien dan panel proyek.
                  </p>
                )}
              </div>
            </nav>
          )}
          <article className="min-w-0 rounded-card border border-gray-200 bg-surface p-5 sm:p-8">
            <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
              {body}
            </Markdown>
          </article>
        </div>
      )}
    </>
  );
}
