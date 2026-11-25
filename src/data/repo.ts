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
  type FirestoreError,
} from "firebase/firestore";
import { normalize, type CollectionName, type Draft, type Records } from "../domain/records";
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
