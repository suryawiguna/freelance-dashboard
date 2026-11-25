import type { ReactNode } from "react";

/** Layar tengah untuk splash, login, dan tolak akses. */
export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-card border border-gray-200 bg-white p-8">{children}</div>
    </main>
  );
}
