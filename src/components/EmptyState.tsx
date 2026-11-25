import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-gray-200 bg-surface px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-gray-600">{children}</div>}
    </div>
  );
}
