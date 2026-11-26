import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { COLLECTIONS, type CollectionName, type Records } from "../domain/records";
import type { Guide } from "../domain/types";
import { watch, watchGuide } from "./repo";
import { LookupProvider } from "./useLookup";

/**
 * Satu listener per koleksi untuk seluruh aplikasi. Datanya kecil (satu
 * pengguna), dan Hari ini serta detail klien butuh semuanya, jadi lebih murah daripada
 * listener per halaman. Berpindah halaman tidak memuat ulang apa pun.
 */
type Data = { [C in CollectionName]: Records[C][] };

interface DataState extends Data {
  /** Panduan (SOP). undefined = belum dimuat, null = belum ada dokumen. */
  guide: Guide | null | undefined;
  loaded: Record<CollectionName, boolean>;
  error: string | null;
}

const DataContext = createContext<DataState | null>(null);

const INITIAL: DataState = {
  services: [],
  clients: [],
  projects: [],
  payments: [],
  assets: [],
  guide: undefined,
  loaded: { services: false, clients: false, projects: false, payments: false, assets: false },
  error: null,
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(INITIAL);

  useEffect(() => {
    const onError = (e: { code: string }) =>
      setState((s) => ({
        ...s,
        error:
          e.code === "permission-denied"
            ? "Akses ditolak. Pastikan UID pemilik di firestore.rules sudah benar."
            : "Gagal memuat data. Coba muat ulang.",
      }));
    const unsubs = COLLECTIONS.map((c) =>
      watch(c, (items) => setState((s) => ({ ...s, [c]: items, loaded: { ...s.loaded, [c]: true } })), onError),
    );
    unsubs.push(watchGuide((guide) => setState((s) => ({ ...s, guide })), onError));
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <DataContext.Provider value={state}>
      <LookupProvider>{children}</LookupProvider>
    </DataContext.Provider>
  );
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData di luar DataProvider");
  return ctx;
}

/** Semua koleksi sudah dimuat sekali. */
export function useAllLoaded(): boolean {
  const { loaded } = useData();
  return Object.values(loaded).every(Boolean);
}
