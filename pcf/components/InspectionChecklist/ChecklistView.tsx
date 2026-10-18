import * as React from "react";
import {
  Badge,
  Button,
  Dropdown,
  Input,
  Option,
  Tab,
  TabList,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Answers, Band, Result } from "./engine/engine";
import type { ParsedQuestion } from "./contract";

// Fusion Sky colours, the same tokens as App 1.
const C = {
  primary: "#0B5F7E",
  purple: "#742774",
  text: "#0F2530",
  muted: "#51646E",
  border: "#CBE2EC",
  wash: "#EDF7FB",
  success: "#167044",
  warning: "#8A5A00",
  error: "#B42318",
};
const BAND_COLOR: Record<Band, string> = { Low: C.success, Medium: C.warning, High: C.error, Critical: C.error };
const STAGES = ["Pre-use", "Visual and structural", "Operational test", "Safety sign-off"];

const useStyles = makeStyles({
  root: {
    display: "flex",
    gap: "24px",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    fontFamily: tokens.fontFamilyBase,
    color: C.text,
  },
  main: { flexGrow: 1, flexBasis: "0", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", gap: "12px" },
  tabs: { flexWrap: "wrap" },
  list: {
    flexGrow: 1,
    minHeight: "0",
    overflowY: "auto",
    backgroundColor: "#FFFFFF",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
  },
  row: { display: "flex", alignItems: "flex-start", gap: "16px", padding: "12px 16px", borderBottom: `1px solid ${C.border}` },
  question: { flexGrow: 1, minWidth: "0", display: "flex", flexDirection: "column", gap: "4px" },
  code: { color: C.muted, fontSize: "13px" },
  answer: { flexShrink: 0, width: "320px", display: "flex", gap: "8px", alignItems: "center" },
  panel: {
    width: "320px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "20px",
    backgroundColor: "#FFFFFF",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    overflowY: "auto",
  },
  eyebrow: { color: C.purple, fontWeight: tokens.fontWeightSemibold, fontSize: "12px", letterSpacing: "0.04em" },
  score: { fontSize: "40px", fontWeight: tokens.fontWeightSemibold, lineHeight: "48px" },
  line: { display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "14px" },
  empty: { padding: "24px", color: C.muted, textAlign: "center" },
});

export interface ChecklistViewProps {
  questions: ParsedQuestion[];
  answers: Answers;
  result: Result;
  readOnly: boolean;
  onAnswer: (questionId: string, value: string | undefined) => void;
}

function depthOf(q: ParsedQuestion, byId: Map<string, ParsedQuestion>): number {
  let depth = 0;
  for (let p = q.parentId; p && byId.has(p) && depth < 100; p = byId.get(p)?.parentId) depth++;
  return depth;
}

export const ChecklistView: React.FC<ChecklistViewProps> = (props) => {
  const { questions, answers, result, readOnly, onAnswer } = props;
  const styles = useStyles();
  const [stage, setStage] = React.useState<string>(STAGES[0]);
  const byId = React.useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const stages = STAGES.filter((s) => questions.some((q) => q.stage === s));
  const visibleInStage = result.visible.filter((q) => q.stage === stage) as ParsedQuestion[];

  const count = (s: string) => {
    const vis = result.visible.filter((q) => q.stage === s);
    const done = vis.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
    return `${done}/${vis.length}`;
  };

  const renderAnswer = (q: ParsedQuestion): React.ReactNode => {
    const value = answers[q.id] ?? "";
    const label = `${q.code} ${q.text}`;
    switch (q.answerType) {
      case "Yes/No":
        return (
          <>
            {["Yes", "No"].map((v) => (
              <Button
                key={v}
                aria-label={`${q.code} ${v}`}
                aria-pressed={value === v}
                appearance={value === v ? "primary" : "outline"}
                disabled={readOnly}
                style={{ minWidth: "96px", height: "44px" }}
                onClick={() => onAnswer(q.id, value === v ? undefined : v)}
              >
                {v}
              </Button>
            ))}
          </>
        );
      case "Choice": {
        const options = (q.options ?? "").split("|").filter((o) => o !== "");
        return (
          <Dropdown
            aria-label={label}
            placeholder="No answer"
            disabled={readOnly}
            value={value}
            selectedOptions={value ? [value] : []}
            style={{ width: "100%", minWidth: "0" }}
            onOptionSelect={(_, data) => onAnswer(q.id, data.optionValue === "" ? undefined : data.optionValue)}
          >
            <Option value="">No answer</Option>
            {options.map((o) => (
              <Option key={o} value={o}>
                {o}
              </Option>
            ))}
          </Dropdown>
        );
      }
      case "Number":
        return (
          <Input
            aria-label={label}
            type="number"
            placeholder="Enter a number"
            disabled={readOnly}
            defaultValue={value}
            key={`${q.id}-${value}`}
            style={{ width: "160px" }}
            onBlur={(e) => onAnswer(q.id, e.target.value.trim() === "" ? undefined : e.target.value.trim())}
          />
        );
      default:
        return (
          <Textarea
            aria-label={label}
            placeholder="Type your comments"
            disabled={readOnly}
            defaultValue={value}
            key={`${q.id}-${value}`}
            style={{ width: "100%" }}
            onBlur={(e) => onAnswer(q.id, e.target.value.trim() === "" ? undefined : e.target.value.trim())}
          />
        );
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        <TabList className={styles.tabs} selectedValue={stage} onTabSelect={(_, d) => setStage(String(d.value))} aria-label="Inspection stages">
          {stages.map((s) => (
            <Tab key={s} value={s}>
              {`${s} ${count(s)}`}
            </Tab>
          ))}
        </TabList>
        <div className={styles.list} role="list" aria-label="Checklist questions for the selected stage">
          {visibleInStage.length === 0 && <div className={styles.empty}>No questions in {stage} for this equipment.</div>}
          {visibleInStage.map((q) => {
            const depth = depthOf(q, byId);
            return (
              <div key={q.id} role="listitem" className={styles.row} style={{ paddingLeft: 16 + depth * 32 }}>
                <div className={styles.question}>
                  <span className={styles.code}>
                    {q.code} · level {depth + 1}{" "}
                    {q.critical && (
                      <Badge appearance="tint" color="danger" size="small">
                        CRITICAL STOP
                      </Badge>
                    )}
                    {q.rule && (
                      <Badge appearance="tint" color="brand" size="small">
                        RULE
                      </Badge>
                    )}
                  </span>
                  <Text weight="semibold" size={400}>
                    {q.text}
                  </Text>
                  {q.help && (
                    <Text size={200} italic style={{ color: C.muted }}>
                      {q.help}
                    </Text>
                  )}
                </div>
                <div className={styles.answer}>{renderAnswer(q)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className={styles.panel} aria-label="Live risk">
        <span className={styles.eyebrow}>LIVE RISK</span>
        <span className={styles.score} aria-label={`Live risk score ${result.score.toFixed(1)} out of 100, ${result.band}`}>
          {result.score.toFixed(1)} / 100
        </span>
        <div
          style={{
            border: `1px solid ${BAND_COLOR[result.band]}`,
            color: result.band === "Critical" ? "#FFFFFF" : BAND_COLOR[result.band],
            backgroundColor: result.band === "Critical" ? C.error : C.wash,
            borderRadius: "6px",
            padding: "12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "18px",
          }}
        >
          {result.band.toUpperCase()}
          {result.criticalHit ? " · critical stop" : ""}
        </div>
        <Text weight="semibold">Why this score</Text>
        {result.lines.length === 0 && <Text style={{ color: C.muted }}>No answers meet a risk condition.</Text>}
        {result.lines.map((l) => (
          <div key={l.code} className={styles.line} style={{ color: l.critical ? C.error : C.text }}>
            <span>
              {l.kind === "rule" ? "Rule " : ""}
              {l.code} {l.label}
            </span>
            <strong>+{l.points}</strong>
          </div>
        ))}
        <div className={styles.line} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: "8px" }}>
          <span>Subtotal</span>
          <span>{result.subtotal}</span>
        </div>
        <div className={styles.line} style={{ color: C.muted }}>
          <span>x Criticality</span>
          <span>{result.multiplier.toFixed(2)}</span>
        </div>
        <div style={{ flexGrow: 1 }} />
        <Text size={200} style={{ color: C.muted }}>
          Answered {result.answeredCount} of {result.visible.length} visible questions
        </Text>
      </aside>
    </div>
  );
};
