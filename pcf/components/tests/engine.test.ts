// Engine tests against the real seed data. Run with: npm test  (node --test, Node 22.6+)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, meets, visibleQuestions, type Question, type RiskRule, type Answers } from "../InspectionChecklist/engine/engine.ts";

const seed = (name: string) => JSON.parse(readFileSync(new URL(`../../../dataverse/seed/${name}`, import.meta.url), "utf8"));

interface SeedQuestion {
  code: string; type: string; stage: string; answer: Question["answerType"]; text: string;
  parent?: string; options?: string; show?: { op: Question["showOp"]; value: string };
  risk?: { op: Question["riskOp"]; value: string; weight: number }; critical?: boolean; rule?: Question["rule"];
}

function questionsFor(type: string): Question[] {
  const all: SeedQuestion[] = seed("checklist-questions.json").questions;
  return all
    .map((q, i) => ({ q, sortKey: (i + 1) * 10 }))
    .filter(({ q }) => q.type === type)
    .map(({ q, sortKey }) => ({
      id: q.code, code: q.code, text: q.text, parentId: q.parent ?? null, stage: q.stage, answerType: q.answer,
      options: q.options ?? null, showOp: q.show?.op ?? null, showValue: q.show?.value ?? null,
      riskOp: q.risk?.op ?? null, riskValue: q.risk?.value ?? null, weight: q.risk?.weight ?? 0,
      critical: !!q.critical, rule: q.rule ?? null, sortKey,
    }));
}

function rulesFor(type: string): RiskRule[] {
  return seed("risk-rules.json").riskRules
    .filter((r: { type: string }) => r.type === type)
    .map((r: { code: string; name: string; bonus: number; explanation: string; rule: RiskRule["rule"] }) => ({ ...r, active: true }));
}

const forklift = questionsFor("Forklift");
const forkliftRules = rulesFor("Forklift");
const codes = (qs: Question[]) => qs.map((q) => q.code);

// The Run 2 answers from App 1 (INS-01002): App 1 scored 52.5, High.
const run2: Answers = {
  "FL-01": "No", "FL-01.1": "Damaged", "FL-01.1.1": "Hydraulics", "FL-01.1.1.1": "Yes",
  "FL-01.1.1.1.1": "No", "FL-01.2": "Yes", "FL-03": "Yes",
};

test("meets mirrors App 1's operators", () => {
  assert.equal(meets("Yes", "Equals", "Yes"), true);
  assert.equal(meets("Worn", "One of", "Worn|Damaged"), true);
  assert.equal(meets("300", "Greater than", "250"), true);
  assert.equal(meets("abc", "Greater than", "250"), false);
  assert.equal(meets("", "Equals", ""), false);
  assert.equal(meets("No", "Not equals", "Yes"), true);
});

test("the sixth level appears (App 1 stops at five)", () => {
  const visible = codes(visibleQuestions(forklift, run2));
  assert.ok(visible.includes("FL-01.1.1.1.1.1"), "FL-01.1.1.1.1.1 should be visible");
});

test("answering the sixth level scores it, including the critical stop", () => {
  const result = evaluate(forklift, forkliftRules, { ...run2, "FL-01.1.1.1.1.1": "No" }, "High");
  assert.ok(result.lines.some((l) => l.code === "FL-01.1.1.1.1.1" && l.critical));
  assert.equal(result.band, "Critical");
});

test("Run 2 answers: the compound leak rule lifts 52.5 High to 75 Critical", () => {
  const result = evaluate(forklift, forkliftRules, run2, "High");
  assert.deepEqual(result.lines.map((l) => [l.code, l.points]), [["FL-01.1.1.1", 20], ["FL-01.1.1.1.1", 15], ["RR-FL-02", 15]]);
  assert.equal(result.subtotal, 50);
  assert.equal(result.score, 75);
  assert.equal(result.band, "Critical");
  const withoutRules = evaluate(forklift, [], run2, "High");
  assert.equal(withoutRules.score, 52.5, "same answers, no compound rules: matches App 1");
  assert.equal(withoutRules.band, "High");
});

test("FL-32 follows the rule stored as data", () => {
  const vis = (a: Answers) => codes(visibleQuestions(forklift, a)).includes("FL-32");
  assert.equal(vis({ "FL-13": "Yes" }), false, "leak alone");
  assert.equal(vis({ "FL-13": "Yes", "FL-30": "No" }), true, "leak and no extinguisher");
  assert.equal(vis({ "FL-20": "No" }), true, "brakes failed");
  assert.equal(vis({ "FL-13": "No", "FL-30": "No" }), false, "no leak");
});

test("answers on a collapsed branch never score", () => {
  const result = evaluate(forklift, forkliftRules, { ...run2, "FL-01": "Yes" }, "High");
  assert.equal(result.lines.length, 0);
  assert.equal(result.score, 0);
  assert.ok(!codes(result.visible).includes("FL-01.1"));
});

test("a critical stop forces Critical regardless of the score", () => {
  const result = evaluate(forklift, forkliftRules, { "FL-03": "No" }, "Low");
  assert.equal(result.score, 30);
  assert.equal(result.band, "Critical");
});

test("the score is capped at 100 and the multiplier applies after compound rules", () => {
  const many: Answers = { "FL-03": "No", "FL-20": "No", "FL-21": "No", "FL-13": "Yes", "FL-30": "No", "FL-31": "No" };
  const result = evaluate(forklift, forkliftRules, many, "High");
  assert.ok(result.lines.some((l) => l.code === "RR-FL-01") && result.lines.some((l) => l.code === "RR-FL-03"));
  assert.equal(result.score, 100);
});

test("inactive rules are ignored", () => {
  const off = forkliftRules.map((r) => ({ ...r, active: false }));
  assert.equal(evaluate(forklift, off, run2, "High").score, 52.5);
});

test("conveyor compound rule: missing guards and blocked emergency stops", () => {
  const result = evaluate(questionsFor("Conveyor"), rulesFor("Conveyor"), { "CV-11": "No", "CV-02": "No" }, "Low");
  assert.deepEqual(result.lines.map((l) => l.code), ["CV-02", "CV-11", "RR-CV-01"]);
  assert.equal(result.score, 70);
  assert.equal(result.band, "Critical", "CV-11 is a critical stop");
});
