// The JSON contract between the Canvas app and the component.
// Inputs use the same field names as App 1's colQ collection, so App 2's Canvas side
// passes JSON(colQ) with one extra column (Rule, the fp_rulejson text).

import type { Answers, AnswerType, Criticality, Operator, Question, Result, RiskRule, RuleNode } from "./engine/engine";

/** One row of colQ as serialised by Canvas JSON(). */
export interface CanvasQuestion {
  QId: string;
  Code: string;
  QText: string;
  Help?: string;
  ParentId?: string | null;
  Stage: string;
  SortKey: number;
  AnswerType: string;
  Options?: string;
  ShowOp?: string;
  ShowVal?: string;
  RiskOp?: string;
  RiskVal?: string;
  Weight?: number;
  Critical?: boolean;
  Rule?: string | null;
}

/** One fp_riskrule row as passed by Canvas. */
export interface CanvasRule {
  Code: string;
  Name: string;
  Bonus: number;
  Explanation?: string;
  Rule: string;
  Active?: boolean;
}

/** One answer, in and out. Contribution is set on output only. */
export interface CanvasAnswer {
  QId: string;
  Code: string;
  Value: string;
  Contribution?: number;
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function parseArray<T>(json: string | null | undefined): T[] {
  if (!json || json.trim() === "") return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function parseRule(text: string | null | undefined): RuleNode | null {
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text) as RuleNode;
  } catch {
    return null;
  }
}

const blankToNull = (s: string | null | undefined): string | null => (s && s.trim() !== "" ? s : null);

export interface ParsedQuestion extends Question {
  help: string | null;
}

export function parseQuestions(json: string | null | undefined): ParsedQuestion[] {
  return parseArray<CanvasQuestion>(json)
    .filter((q) => !!q?.QId && !!q.Code)
    .map((q) => ({
      id: q.QId,
      code: q.Code,
      text: q.QText ?? "",
      help: blankToNull(q.Help),
      parentId: q.ParentId && q.ParentId !== EMPTY_GUID ? q.ParentId : null,
      stage: q.Stage ?? "",
      answerType: (q.AnswerType as AnswerType) ?? "Yes/No",
      options: blankToNull(q.Options),
      showOp: blankToNull(q.ShowOp) as Operator | null,
      showValue: blankToNull(q.ShowVal),
      riskOp: blankToNull(q.RiskOp) as Operator | null,
      riskValue: blankToNull(q.RiskVal),
      weight: Number(q.Weight ?? 0) || 0,
      critical: !!q.Critical,
      rule: parseRule(q.Rule),
      sortKey: Number(q.SortKey ?? 0) || 0,
    }));
}

export function parseRules(json: string | null | undefined): RiskRule[] {
  return parseArray<CanvasRule>(json)
    .map((r) => ({ r, rule: parseRule(r.Rule) }))
    .filter(({ rule }) => rule !== null)
    .map(({ r, rule }) => ({
      code: r.Code,
      name: r.Name,
      bonus: Number(r.Bonus) || 0,
      explanation: r.Explanation ?? "",
      rule: rule!,
      active: r.Active !== false,
    }));
}

export function parseAnswers(json: string | null | undefined): Answers {
  const answers: Answers = {};
  for (const a of parseArray<CanvasAnswer>(json)) {
    if (a?.QId && a.Value !== undefined && a.Value !== null && String(a.Value).trim() !== "") answers[a.QId] = String(a.Value);
  }
  return answers;
}

export function parseCriticality(value: string | null | undefined): Criticality {
  return value === "High" || value === "Medium" ? value : "Low";
}

/** Answers for visible questions only, each with its risk contribution after the multiplier. */
export function answersOut(result: Result, answers: Answers): CanvasAnswer[] {
  const triggered = new Map(result.lines.filter((l) => l.kind === "question").map((l) => [l.code, l.points]));
  return result.visible
    .filter((q) => answers[q.id] !== undefined && String(answers[q.id]).trim() !== "")
    .map((q) => ({
      QId: q.id,
      Code: q.code,
      Value: String(answers[q.id]),
      Contribution: Math.round((triggered.get(q.code) ?? 0) * result.multiplier * 10) / 10,
    }));
}
