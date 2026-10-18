// Contract tests: Canvas-shaped JSON in, the same results as the engine tests out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answersOut, parseAnswers, parseCriticality, parseQuestions, parseRules } from "../InspectionChecklist/contract.ts";
import { evaluate } from "../InspectionChecklist/engine/engine.ts";

const sample = (name: string) => readFileSync(new URL(`./samples/${name}`, import.meta.url), "utf8");
const questions = parseQuestions(sample("questions-forklift.json"));
const rules = parseRules(sample("rules-forklift.json"));

const answersJson = JSON.stringify([
  { QId: "FL-01", Code: "FL-01", Value: "No" },
  { QId: "FL-01.1", Code: "FL-01.1", Value: "Damaged" },
  { QId: "FL-01.1.1", Code: "FL-01.1.1", Value: "Hydraulics" },
  { QId: "FL-01.1.1.1", Code: "FL-01.1.1.1", Value: "Yes" },
  { QId: "FL-01.1.1.1.1", Code: "FL-01.1.1.1.1", Value: "No" },
  { QId: "FL-01.2", Code: "FL-01.2", Value: "Yes" },
  { QId: "FL-03", Code: "FL-03", Value: "Yes" },
]);

test("Canvas JSON parses: blank ParentId means root, Rule text becomes a tree", () => {
  assert.equal(questions.length, 30);
  assert.equal(questions.find((q) => q.code === "FL-01")?.parentId, null);
  assert.equal(questions.find((q) => q.code === "FL-01.1")?.parentId, "FL-01");
  assert.ok(questions.find((q) => q.code === "FL-32")?.rule);
  assert.equal(rules.length, 4);
});

test("Run 2 answers through the contract: 75 Critical, contributions after the multiplier", () => {
  const answers = parseAnswers(answersJson);
  const result = evaluate(questions, rules, answers, parseCriticality("High"));
  assert.equal(result.score, 75);
  assert.equal(result.band, "Critical");
  const out = answersOut(result, answers);
  assert.equal(out.length, 7);
  assert.equal(out.find((a) => a.Code === "FL-01.1.1.1")?.Contribution, 30);
  assert.equal(out.find((a) => a.Code === "FL-01.2")?.Contribution, 0);
});

test("answers on a collapsed branch are dropped from AnswersOut", () => {
  const answers = { ...parseAnswers(answersJson), "FL-01": "Yes" };
  const out = answersOut(evaluate(questions, rules, answers, "High"), answers);
  assert.deepEqual(out.map((a) => a.Code), ["FL-01", "FL-03"]);
});

test("AnswersJson can be keyed on the inspection", () => {
  assert.deepEqual(parseAnswers('{"Inspection":"INS-01005"}'), {});
  assert.deepEqual(parseAnswers('{"Inspection":"x","Answers":[{"QId":"FL-01","Code":"FL-01","Value":"No"}]}'), { "FL-01": "No" });
});

test("bad input never throws", () => {
  assert.deepEqual(parseQuestions("not json"), []);
  assert.deepEqual(parseRules('[{"Code":"X","Rule":"{bad"}]'), []);
  assert.deepEqual(parseAnswers(""), {});
  assert.equal(parseCriticality(undefined), "Low");
});
