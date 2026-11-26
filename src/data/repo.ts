/**
 * Satu-satunya tempat yang menyentuh Firestore (PLAN §8, dijaga npm run lint).
 *
 * Penulisan tidak ditunggu sampai server menjawab: dengan offline persistence,
 * promise baru selesai saat online lagi. Pemanggil menutup panel langsung dan
 * hanya menampilkan pesan bila promise gagal (mis. ditolak rules).
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";
import { normalize, type CollectionName, type Draft, type Records } from "../domain/records";
import { GUIDE_ID, type Guide } from "../domain/types";
import { db } from "./firebase";

export function watch<C extends CollectionName>(
  c: C,
  onData: (items: Records[C][]) => void,
  onError: (e: FirestoreError) => void,
): () => void {
  return onSnapshot(
    collection(db, c),
    (snap) => onData(snap.docs.map((d) => normalize(c, d.id, d.data()))),
    onError,
  );
}

/** Id baru tanpa menulis apa pun, supaya pemanggil bisa langsung membuka dokumennya. */
export function newId(c: CollectionName): string {
  return doc(collection(db, c)).id;
}

export function create<C extends CollectionName>(c: C, data: Draft<Records[C]>, id = newId(c)) {
  const promise = setDoc(doc(db, c, id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id, promise };
}

export function update<C extends CollectionName>(c: C, id: string, data: Partial<Draft<Records[C]>>): Promise<void> {
  return updateDoc(doc(db, c, id), { ...data, updatedAt: serverTimestamp() });
}

export function remove(c: CollectionName, id: string): Promise<void> {
  return deleteDoc(doc(db, c, id));
}

export type BatchOp =
  | { op: "create"; c: CollectionName; id: string; data: Record<string, unknown> }
  | { op: "update"; c: CollectionName; id: string; data: Record<string, unknown> }
  | { op: "delete"; c: CollectionName; id: string };

/** Helper bertipe untuk menyusun BatchOp. */
export const ops = {
  create: <C extends CollectionName>(c: C, id: string, data: Draft<Records[C]>): BatchOp => ({ op: "create", c, id, data }),
  update: <C extends CollectionName>(c: C, id: string, data: Partial<Draft<Records[C]>>): BatchOp => ({ op: "update", c, id, data }),
  delete: (c: CollectionName, id: string): BatchOp => ({ op: "delete", c, id }),
};

/**
 * Beberapa tulis sekaligus, semua atau tidak sama sekali: klien + proyek
 * pertamanya, hapus klien beserta isinya, tagihan langganan sebulan.
 * Induk harus ditulis sebelum anaknya di daftar (rules memakai existsAfter,
 * jadi urutan di batch sebenarnya bebas, tetapi urutan ini lebih mudah dibaca).
 */
export function batch(list: readonly BatchOp[]): Promise<void> {
  const b = writeBatch(db);
  for (const o of list) {
    const ref = doc(db, o.c, o.id);
    if (o.op === "create") b.set(ref, { ...o.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    else if (o.op === "update") b.update(ref, { ...o.data, updatedAt: serverTimestamp() });
    else b.delete(ref);
  }
  return b.commit();
}

// ---- Panduan (satu dokumen guides/sop) ----

/** null = belum ada dokumen. */
export function watchGuide(onData: (g: Guide | null) => void, onError: (e: FirestoreError) => void): () => void {
  return onSnapshot(
    doc(db, "guides", GUIDE_ID),
    (snap) => {
      const body = snap.get("body");
      onData(snap.exists() ? { body: typeof body === "string" ? body : "" } : null);
    },
    onError,
  );
}

/** Buat dokumen bila belum ada, selain itu ubah body saja (createdAt tetap). */
export function saveGuide(body: string, exists: boolean): Promise<void> {
  const ref = doc(db, "guides", GUIDE_ID);
  return exists
    ? updateDoc(ref, { body, updatedAt: serverTimestamp() })
    : setDoc(ref, { body, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
