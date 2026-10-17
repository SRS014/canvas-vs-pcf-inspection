// Annotation marks for App 2's PhotoAnnotator. Pure data and drawing helpers, no React.
// Coordinates are relative to the image (0 to 1), so marks line up at any display size
// and can be burned into the full-resolution photo.

export type MarkType = "marker" | "arrow" | "box" | "pen" | "note";

export interface Point {
  x: number;
  y: number;
}

export interface Mark {
  id: string;
  type: MarkType;
  points: Point[];
  color: string;
  /** Marker number, shown in the circle. */
  number?: number;
  /** Note text, or the description of a marker. */
  text?: string;
}

export const COLORS = [
  { name: "Red", value: "#D13438" },
  { name: "Amber", value: "#C77700" },
  { name: "Blue", value: "#0B5F7E" },
];

const clamp = (n: number): number => Math.min(1, Math.max(0, n));

export function parseMarks(json: string | null | undefined): Mark[] {
  if (!json || json.trim() === "") return [];
  try {
    const value: unknown = JSON.parse(json);
    const list = Array.isArray(value) ? value : (value as { marks?: unknown })?.marks;
    if (!Array.isArray(list)) return [];
    return list
      .filter((m): m is Mark => !!m && typeof m === "object" && Array.isArray((m as Mark).points))
      .map((m) => ({ ...m, points: m.points.map((p) => ({ x: clamp(Number(p.x)), y: clamp(Number(p.y)) })) }));
  } catch {
    return [];
  }
}

export function serialiseMarks(marks: Mark[]): string {
  return JSON.stringify({ version: 1, marks });
}

export function nextMarkerNumber(marks: Mark[]): number {
  return marks.filter((m) => m.type === "marker").reduce((max, m) => Math.max(max, m.number ?? 0), 0) + 1;
}

/** Draw marks onto a 2D context of the given pixel size. Used for the flattened output. */
export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[], width: number, height: number): void {
  const unit = Math.max(width, height) / 400; // line width and text scale with the photo
  const px = (p: Point) => ({ x: p.x * width, y: p.y * height });
  for (const m of marks) {
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    ctx.lineWidth = 2.5 * unit;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pts = m.points.map(px);
    switch (m.type) {
      case "box": {
        if (pts.length < 2) break;
        const [a, b] = pts;
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        break;
      }
      case "arrow": {
        if (pts.length < 2) break;
        const [a, b] = pts;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const head = 10 * unit;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "pen": {
        if (pts.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
      }
      case "marker": {
        const p = pts[0];
        if (!p) break;
        const r = 11 * unit;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `600 ${13 * unit}px Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(m.number ?? ""), p.x, p.y);
        break;
      }
      case "note": {
        const p = pts[0];
        if (!p || !m.text) break;
        ctx.font = `600 ${12 * unit}px Segoe UI, sans-serif`;
        const pad = 4 * unit;
        const w = ctx.measureText(m.text).width + pad * 2;
        const h = 18 * unit;
        ctx.fillRect(p.x, p.y - h / 2, w, h);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(m.text, p.x + pad, p.y);
        break;
      }
    }
  }
}

/** Burn the marks into the photo at its original resolution and return a JPEG data URI. */
export function flatten(image: HTMLImageElement, marks: Mark[]): string {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(image, 0, 0, width, height);
  drawMarks(ctx, marks, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
