import * as React from "react";
import { Button, Input, Text, ToggleButton, Toolbar, ToolbarDivider, makeStyles, tokens } from "@fluentui/react-components";
import { COLORS, Mark, MarkType, Point, nextMarkerNumber } from "./marks";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    fontFamily: tokens.fontFamilyBase,
  },
  toolbar: { flexWrap: "wrap", flexShrink: 0 },
  hint: { color: "#51646E", marginLeft: "8px" },
  stage: { position: "relative", flexGrow: 1, minHeight: "0", backgroundColor: "#0F2530", borderRadius: "8px", overflow: "hidden" },
  img: { position: "absolute", userSelect: "none", pointerEvents: "none" },
  svg: { position: "absolute", touchAction: "none" },
  empty: { color: "#FFFFFF", padding: "24px" },
});

const TOOLS: { type: MarkType | "select"; label: string }[] = [
  { type: "marker", label: "Numbered marker" },
  { type: "arrow", label: "Arrow" },
  { type: "box", label: "Box" },
  { type: "pen", label: "Freehand" },
  { type: "note", label: "Note" },
  { type: "select", label: "Select" },
];

export interface AnnotatorViewProps {
  src: string;
  marks: Mark[];
  readOnly: boolean;
  onChange: (marks: Mark[]) => void;
  onImageLoad: (img: HTMLImageElement) => void;
}

let idCounter = 0;
const newId = (): string => `m${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const AnnotatorView: React.FC<AnnotatorViewProps> = (props) => {
  const { src, marks, readOnly, onChange, onImageLoad } = props;
  const styles = useStyles();
  const [tool, setTool] = React.useState<MarkType | "select">("marker");
  const [color, setColor] = React.useState(COLORS[0].value);
  const [noteText, setNoteText] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Mark | null>(null);
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const stageRef = React.useRef<HTMLDivElement>(null);

  // Measure the photo area: the toolbar can wrap, so its height is not fixed.
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit the photo inside the stage (object-fit: contain) and overlay the SVG on exactly that box.
  const stageW = size.w;
  const stageH = size.h;
  const scale = natural.w && natural.h ? Math.min(stageW / natural.w, stageH / natural.h) : 0;
  const box = { w: natural.w * scale, h: natural.h * scale, x: (stageW - natural.w * scale) / 2, y: (stageH - natural.h * scale) / 2 };

  const toPoint = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || tool === "select") return;
    const p = toPoint(e);
    if (tool === "marker") {
      onChange([...marks, { id: newId(), type: "marker", points: [p], color, number: nextMarkerNumber(marks), text: noteText || undefined }]);
      return;
    }
    if (tool === "note") {
      if (noteText.trim() === "") return;
      onChange([...marks, { id: newId(), type: "note", points: [p], color, text: noteText.trim() }]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ id: newId(), type: tool, points: [p, p], color });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draft) return;
    const p = toPoint(e);
    setDraft(draft.type === "pen" ? { ...draft, points: [...draft.points, p] } : { ...draft, points: [draft.points[0], p] });
  };

  const onPointerUp = () => {
    if (!draft) return;
    const [a, b] = [draft.points[0], draft.points[draft.points.length - 1]];
    const moved = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 0.01;
    if (moved) onChange([...marks, draft]);
    setDraft(null);
  };

  const renderMark = (m: Mark, isDraft = false): React.ReactNode => {
    const pts = m.points.map((p) => ({ x: p.x * box.w, y: p.y * box.h }));
    const isSel = m.id === selected;
    const common = {
      stroke: m.color,
      strokeWidth: isSel ? 4 : 2.5,
      fill: "none",
      onClick: tool === "select" && !isDraft ? () => setSelected(m.id) : undefined,
      style: { cursor: tool === "select" ? "pointer" : undefined },
    };
    switch (m.type) {
      case "box": {
        const [a, b] = pts;
        return <rect key={m.id} {...common} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} />;
      }
      case "arrow": {
        const [a, b] = pts;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const h = 12;
        const head = `${b.x},${b.y} ${b.x - h * Math.cos(angle - Math.PI / 6)},${b.y - h * Math.sin(angle - Math.PI / 6)} ${b.x - h * Math.cos(angle + Math.PI / 6)},${b.y - h * Math.sin(angle + Math.PI / 6)}`;
        return (
          <g key={m.id} onClick={common.onClick} style={common.style}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={m.color} strokeWidth={common.strokeWidth} strokeLinecap="round" />
            <polygon points={head} fill={m.color} />
          </g>
        );
      }
      case "pen":
        return <polyline key={m.id} {...common} strokeLinecap="round" strokeLinejoin="round" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />;
      case "marker":
        return (
          <g key={m.id} onClick={common.onClick} style={common.style}>
            <circle cx={pts[0].x} cy={pts[0].y} r={isSel ? 15 : 13} fill={m.color} />
            <text x={pts[0].x} y={pts[0].y} fill="#FFFFFF" fontSize="14" fontWeight="600" textAnchor="middle" dominantBaseline="central">
              {m.number}
            </text>
            {m.text && <title>{m.text}</title>}
          </g>
        );
      case "note":
        return (
          <g key={m.id} onClick={common.onClick} style={common.style}>
            <rect x={pts[0].x} y={pts[0].y - 11} width={(m.text?.length ?? 0) * 7.5 + 12} height={22} rx={4} fill={m.color} stroke={isSel ? "#FFFFFF" : "none"} />
            <text x={pts[0].x + 6} y={pts[0].y} fill="#FFFFFF" fontSize="13" fontWeight="600" dominantBaseline="central">
              {m.text}
            </text>
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.root}>
      <Toolbar className={styles.toolbar} aria-label="Annotation tools" size="small">
        {TOOLS.map((t) => (
          <ToggleButton key={t.type} checked={tool === t.type} disabled={readOnly} onClick={() => setTool(t.type)} appearance="subtle">
            {t.label}
          </ToggleButton>
        ))}
        <ToolbarDivider />
        {COLORS.map((c) => (
          <ToggleButton
            key={c.value}
            aria-label={`${c.name} colour`}
            checked={color === c.value}
            disabled={readOnly}
            onClick={() => setColor(c.value)}
            appearance="subtle"
            icon={<span style={{ display: "inline-block", width: 16, height: 16, borderRadius: 8, backgroundColor: c.value }} />}
          />
        ))}
        <ToolbarDivider />
        <Input
          aria-label="Note or marker description"
          placeholder="Note text"
          size="small"
          value={noteText}
          disabled={readOnly}
          onChange={(_, d) => setNoteText(d.value)}
          style={{ width: 180 }}
        />
        <ToolbarDivider />
        <Button appearance="subtle" disabled={readOnly || marks.length === 0} onClick={() => onChange(marks.slice(0, -1))}>
          Undo
        </Button>
        <Button
          appearance="subtle"
          disabled={readOnly || !selected}
          onClick={() => {
            onChange(marks.filter((m) => m.id !== selected));
            setSelected(null);
          }}
        >
          Delete selected
        </Button>
        <Text size={200} style={{ marginLeft: 8 }}>
          {marks.length} mark{marks.length === 1 ? "" : "s"}
        </Text>
        {tool === "note" && noteText.trim() === "" && !readOnly && (
          <Text size={200} className={styles.hint}>
            Type the note text, then click the photo.
          </Text>
        )}
      </Toolbar>
      <div ref={stageRef} className={styles.stage}>
        {!src && <div className={styles.empty}>No photo selected.</div>}
        {src && (
          <>
            <img
              className={styles.img}
              src={src}
              alt="Inspection photo"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                onImageLoad(img);
              }}
            />
            {scale > 0 && (
              <svg
                className={styles.svg}
                role="img"
                aria-label={`Photo annotations, ${marks.length} marks`}
                style={{ left: box.x, top: box.y, width: box.w, height: box.h, cursor: readOnly ? "default" : "crosshair" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {marks.map((m) => renderMark(m))}
                {draft && renderMark(draft, true)}
              </svg>
            )}
          </>
        )}
      </div>
    </div>
  );
};
