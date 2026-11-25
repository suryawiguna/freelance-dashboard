/**
 * Posisi popover (dropdown, kalender) terhadap pemicunya, dalam koordinat
 * viewport untuk position: fixed. Murni, dites. Membuka ke bawah bila muat,
 * ke atas bila ruang di atas lebih lega, dan tidak pernah keluar layar.
 */

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface Placement {
  top: number;
  left: number;
  maxHeight: number;
  side: "bottom" | "top";
}

export function placePopover(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 6,
  margin = 8,
): Placement {
  const below = viewport.height - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  const side = size.height <= below || below >= above ? "bottom" : "top";
  const maxHeight = Math.max(0, side === "bottom" ? below : above);
  const height = Math.min(size.height, maxHeight);
  const top = side === "bottom" ? anchor.bottom + gap : anchor.top - gap - height;
  const maxLeft = viewport.width - size.width - margin;
  const left = Math.max(margin, Math.min(anchor.left, maxLeft));
  return { top, left, maxHeight, side };
}
