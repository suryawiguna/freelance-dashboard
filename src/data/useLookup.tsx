import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Client, Project, Service } from "../domain/types";
import { buildClientViews, type ClientView } from "../lib/clients";
import { useData } from "./DataContext";

export interface Lookup {
  client: (id: string | null) => Client | undefined;
  /** Nama untuk ditampilkan. null = aset milik sendiri. */
  clientName: (id: string | null) => string;
  service: (id: string | null) => Service | undefined;
  project: (id: string | null) => Project | undefined;
  /** Nama proyek untuk ditampilkan: nama, atau nama jasa, atau "Jasa belum dipilih". */
  projectName: (p: Project | undefined) => string;
  views: Map<string, ClientView>;
  /** Klien urut nama, untuk pilihan di form. */
  clientOptions: { value: string; label: string }[];
}

const LookupContext = createContext<Lookup | null>(null);

/**
 * Relasi lewat id (PLAN-KLIEN §3): nama klien dan jasa selalu dicari di sini,
 * tidak pernah disalin ke dokumen lain, jadi mengganti nama ikut ke semua
 * halaman. Dihitung sekali per perubahan data untuk seluruh aplikasi.
 */
export function LookupProvider({ children }: { children: ReactNode }) {
  const { clients, services, projects, payments } = useData();
  const value = useMemo<Lookup>(() => {
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const service = (id: string | null) => (id ? serviceById.get(id) : undefined);
    return {
      client: (id) => (id ? clientById.get(id) : undefined),
      clientName: (id) => (id === null ? "Milik sendiri" : (clientById.get(id)?.name ?? "Klien terhapus")),
      service,
      project: (id) => (id ? projectById.get(id) : undefined),
      projectName: (p) => p?.name || service(p?.serviceId ?? null)?.name || "Jasa belum dipilih",
      views: buildClientViews(clients, projects, payments),
      clientOptions: [...clients]
        .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }))
        .map((c) => ({ value: c.id, label: c.name })),
    };
  }, [clients, services, projects, payments]);
  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
}

export function useLookup(): Lookup {
  const ctx = useContext(LookupContext);
  if (!ctx) throw new Error("useLookup di luar LookupProvider");
  return ctx;
}
