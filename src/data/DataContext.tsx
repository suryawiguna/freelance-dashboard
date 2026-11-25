import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { COLLECTIONS, type CollectionName, type Records } from "../domain/records";
import { watch } from "./repo";

/**
 * Satu listener per koleksi untuk seluruh aplikasi. Datanya kecil (satu
 * pengguna), dan Ringkasan butuh keempatnya, jadi lebih murah daripada
 * listener per halaman. Berpindah halaman tidak memuat ulang apa pun.
 */
type Data = { [C in CollectionName]: Records[C][] };

interface DataState extends Data {
  loaded: Record<CollectionName, boolean>;
  error: string | null;
}

const DataContext = createContext<DataState | null>(null);

const INITIAL: DataState = {
  leads: [],
  projects: [],
  payments: [],
  assets: [],
  loaded: { leads: false, projects: false, payments: false, assets: false },
  error: null,
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(INITIAL);

  useEffect(() => {
    const unsubs = COLLECTIONS.map((c) =>
      watch(
        c,
        (items) => setState((s) => ({ ...s, [c]: items, loaded: { ...s.loaded, [c]: true } })),
        (e) =>
          setState((s) => ({
            ...s,
            error:
              e.code === "permission-denied"
                ? "Akses ditolak. Pastikan UID pemilik di firestore.rules sudah benar."
                : "Gagal memuat data. Coba muat ulang.",
          })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  return <DataContext.Provider value={state}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData di luar DataProvider");
  return ctx;
}
