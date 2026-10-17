// Checklist engine for App 2: visibility, cross-question rules and risk scoring.
// Pure TypeScript with no runtime imports, so it runs in the PCF bundle and under
// `node --test` unchanged. The same semantics as App 1 (Meets, multiplier, bands,
// cap), without App 1's limits: any depth, generic rule trees, compound rules.

export type Operator = "Equals" | "Not equals" | "Greater than" | "Less than" | "One of";
export type AnswerType = "Yes/No" | "Choice" | "Number" | "Text";
export type Criticality = "Low" | "Medium" | "High";
export type Band = "Low" | "Medium" | "High" | "Critical";

export type RuleNode = { any: RuleNode[] } | { all: RuleNode[] } | { q: string; op: Operator; v: string };

export interface Question {
  id: string;
  code: string;
  text: string;
  parentId?: string | null;
  stage: string;
  answerType: AnswerType;
  options?: string | null;
  showOp?: Operator | null;
  showValue?: string | null;
  riskOp?: Operator | null;
  riskValue?: string | null;
  weight: number;
  critical: boolean;
  rule?: RuleNode | null;
  sortKey: number;
}

export interface RiskRule {
  code: string;
  name: string;
  bonus: number;
  explanation: string;
  rule: RuleNode;
  active: boolean;
}

/** Answers keyed by question id. Blank strings count as unanswered. */
export type Answers = Record<string, string | undefined>;

export interface ScoreLine {
  kind: "question" | "rule";
  code: string;
  label: string;
  points: number;
  critical: boolean;
}

export interface Result {
  visible: Question[];
  answeredCount: number;
  lines: ScoreLine[];
  subtotal: number;
  multiplier: number;
  score: number;
  band: Band;
  criticalHit: boolean;
}

const MULTIPLIER: Record<Criticality, number> = { Low: 1, Medium: 1.25, High: 1.5 };

const isBlank = (s: string | undefined | null): boolean => s === undefined || s === null || s.trim() === "";

function toNumber(s: string): number | null {
  if (isBlank(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Does an answer meet a condition? Mirrors App 1's Meets(). */
export function meets(answer: string | undefined | null, op: Operator | null | undefined, value: string | null | undefined): boolean {
  if (isBlank(answer) || !op) return false;
  const a = answer!;
  const v = value ?? "";
  switch (op) {
    case "Equals":
      return a === v;
    case "Not equals":
      return a !== v;
    case "Greater than": {
      const x = toNumber(a), y = toNumber(v);
      return x !== null && y !== null && x > y;
    }
    case "Less than": {
      const x = toNumber(a), y = toNumber(v);
      return x !== null && y !== null && x < y;
    }
    case "One of":
      return v.split("|").includes(a);
    default:
      return false;
  }
}

/** Evaluate an any / all rule tree against answers keyed by question code. Any depth. */
export function evaluateRule(node: RuleNode, answersByCode: Record<string, string | undefined>): boolean {
  if ("any" in node) return node.any.some((n) => evaluateRule(n, answersByCode));
  if ("all" in node) return node.all.length > 0 && node.all.every((n) => evaluateRule(n, answersByCode));
  return meets(answersByCode[node.q], node.op, node.v);
}

/**
 * Visible questions, in sort order. A question is visible when its parent is visible,
 * the parent's answer meets its show condition, and its own rule (if any) is met by the
 * answers of other visible questions. Recursion, so there is no depth limit.
 */
export function visibleQuestions(questions: Question[], answers: Answers): Question[] {
  const children = new Map<string, Question[]>();
  const roots: Question[] = [];
  for (const q of [...questions].sort((a, b) => a.sortKey - b.sortKey)) {
    if (q.parentId) {
      const list = children.get(q.parentId) ?? [];
      list.push(q);
      children.set(q.parentId, list);
    } else roots.push(q);
  }

  // Rule-gated questions start hidden and are switched on while their rule is met.
  // Rules can depend on each other, so iterate until the visible set stops changing.
  const ruleOpen = new Set<string>();
  let visible: Question[] = [];
  for (let pass = 0; pass <= questions.length; pass++) {
    visible = [];
    const walk = (q: Question, parentAnswer: string | undefined, isRoot: boolean): void => {
      if (!isRoot && !meets(parentAnswer, q.showOp, q.showValue)) return;
      if (q.rule && !ruleOpen.has(q.id)) return;
      visible.push(q);
      for (const c of children.get(q.id) ?? []) walk(c, answers[q.id], false);
    };
    for (const r of roots) walk(r, undefined, true);

    const byCode = answersByCode(visible, answers);
    const next = new Set(questions.filter((q) => q.rule && evaluateRule(q.rule, byCode)).map((q) => q.id));
    if (next.size === ruleOpen.size && [...next].every((id) => ruleOpen.has(id))) break;
    ruleOpen.clear();
    next.forEach((id) => ruleOpen.add(id));
  }
  return visible.sort((a, b) => a.sortKey - b.sortKey);
}

function answersByCode(visible: Question[], answers: Answers): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const q of visible) if (!isBlank(answers[q.id])) map[q.code] = answers[q.id];
  return map;
}

export function band(score: number, criticalStop: boolean): Band {
  if (criticalStop || score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

/** Score the inspection. Only visible questions count; compound rules add bonus points. */
export function evaluate(questions: Question[], rules: RiskRule[], answers: Answers, criticality: Criticality): Result {
  const visible = visibleQuestions(questions, answers);
  const lines: ScoreLine[] = [];
  for (const q of visible) {
    if (q.weight > 0 && meets(answers[q.id], q.riskOp, q.riskValue)) {
      lines.push({ kind: "question", code: q.code, label: q.text, points: q.weight, critical: q.critical });
    }
  }
  const byCode = answersByCode(visible, answers);
  for (const r of rules) {
    if (r.active && r.bonus > 0 && evaluateRule(r.rule, byCode)) {
      lines.push({ kind: "rule", code: r.code, label: r.name, points: r.bonus, critical: false });
    }
  }
  const subtotal = lines.reduce((sum, l) => sum + l.points, 0);
  const multiplier = MULTIPLIER[criticality] ?? 1;
  const score = Math.min(100, Math.round(subtotal * multiplier * 10) / 10);
  const criticalHit = lines.some((l) => l.critical);
  return {
    visible,
    answeredCount: visible.filter((q) => !isBlank(answers[q.id])).length,
    lines,
    subtotal,
    multiplier,
    score,
    band: band(score, criticalHit),
    criticalHit,
  };
}
