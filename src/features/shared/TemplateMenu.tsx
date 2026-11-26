import * as Popover from "@radix-ui/react-popover";
import { Copy, MessageSquareText } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { useToast } from "../../components/Toast";
import { useData } from "../../data/DataContext";
import { fillTemplate, parseTemplates } from "../../domain/templates";
import { copyText } from "../../lib/clipboard";
import { closeEditAndGo, navigate, parseEdit } from "../../lib/route";

const GUIDE_PATH = "/panduan";

/**
 * Tombol "Template pesan": daftar template dari Panduan, masing-masing dengan
 * tombol Salin. `[link]` diisi link proyek bila ada.
 */
export function TemplateMenu({ link = "" }: { link?: string }) {
  const { guide } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const templates = useMemo(() => parseTemplates(guide?.body ?? ""), [guide]);

  const copy = async (title: string, text: string) => {
    if (await copyText(fillTemplate(text, { link }))) {
      toast(`"${title}" disalin.`);
      setOpen(false);
    } else {
      toast("Gagal menyalin. Salin manual dari Panduan.", "error");
    }
  };

  const toGuide = () => {
    setOpen(false);
    if (parseEdit(window.location.search)) closeEditAndGo(GUIDE_PATH);
    else navigate(GUIDE_PATH);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button>
          <MessageSquareText size={18} aria-hidden />
          Template pesan
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(26rem,calc(100vw-1rem))] animate-pop-in overflow-y-auto rounded-card border border-gray-200 bg-surface p-2 shadow-lg outline-none motion-reduce:animate-none"
        >
          {templates.length === 0 ? (
            <div className="space-y-2 p-2">
              <p className="text-gray-600">
                Belum ada template. Tulis di Panduan: baris tebal sebagai judul, lalu kutipan sebagai isi.
              </p>
              <Button variant="ghost" className="px-2 text-accent" onClick={toGuide}>
                Buka Panduan
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {templates.map((t, i) => (
                <li key={`${i}-${t.title}`} className="flex items-start gap-2 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{t.title}</p>
                    <p className="line-clamp-2 text-gray-600">{fillTemplate(t.text, { link })}</p>
                  </div>
                  <Button
                    icon
                    variant="ghost"
                    aria-label={`Salin ${t.title}`}
                    title="Salin"
                    onClick={() => void copy(t.title, t.text)}
                  >
                    <Copy size={18} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
