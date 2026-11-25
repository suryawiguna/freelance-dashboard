import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./Button";

/** Versi baru tersedia: pengguna yang memilih kapan memuat ulang. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm sm:bottom-6"
    >
      <p className="flex-1">Versi baru tersedia.</p>
      <Button onClick={() => setNeedRefresh(false)}>Nanti</Button>
      <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
        Muat ulang
      </Button>
    </div>
  );
}
