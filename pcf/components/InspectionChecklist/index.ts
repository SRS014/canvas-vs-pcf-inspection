import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { FluentProvider } from "@fluentui/react-components";
import { fusionTheme } from "../shared/theme";
import { ChecklistView } from "./ChecklistView";
import { answersOut, parseAnswers, parseCriticality, parseQuestions, parseRules, ParsedQuestion } from "./contract";
import { evaluate, type Answers, type Result, type RiskRule } from "./engine/engine";

/**
 * InspectionChecklist: the recursive checklist, cross-question rules and risk engine for App 2.
 * The Canvas app passes questions, rules and saved answers in as JSON and reads the answers,
 * score and explanation back from the outputs. The component never calls Dataverse.
 */
export class InspectionChecklist implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private notifyOutputChanged: () => void;
  private questions: ParsedQuestion[] = [];
  private rules: RiskRule[] = [];
  private answers: Answers = {};
  private result: Result | null = null;
  private lastQuestionsJson = "";
  private lastRulesJson = "";
  private lastAnswersJson: string | null = null;
  private criticality: "Low" | "Medium" | "High" = "Low";

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
    this.notifyOutputChanged = notifyOutputChanged;
    context.mode.trackContainerResize(true);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const p = context.parameters;
    const questionsJson = p.QuestionsJson.raw ?? "";
    const rulesJson = p.RulesJson.raw ?? "";
    const answersJson = p.AnswersJson.raw ?? "";
    let changed = false;

    if (questionsJson !== this.lastQuestionsJson) {
      this.lastQuestionsJson = questionsJson;
      this.questions = parseQuestions(questionsJson);
      changed = true;
    }
    if (rulesJson !== this.lastRulesJson) {
      this.lastRulesJson = rulesJson;
      this.rules = parseRules(rulesJson);
      changed = true;
    }
    // A new AnswersJson from Canvas (new inspection or resumed draft) replaces local answers.
    if (answersJson !== this.lastAnswersJson) {
      this.lastAnswersJson = answersJson;
      this.answers = parseAnswers(answersJson);
      changed = true;
    }
    const criticality = parseCriticality(p.Criticality.raw);
    if (criticality !== this.criticality || this.result === null) {
      this.criticality = criticality;
      changed = true;
    }
    if (changed || this.result === null) this.recalculate(false);

    const view = React.createElement(ChecklistView, {
      questions: this.questions,
      answers: this.answers,
      result: this.result!,
      readOnly: p.ReadOnly.raw === true,
      width: Number(context.mode.allocatedWidth) > 0 ? Number(context.mode.allocatedWidth) : 1000,
      height: Number(context.mode.allocatedHeight) > 0 ? Number(context.mode.allocatedHeight) : 600,
      onAnswer: this.onAnswer,
    });
    return React.createElement(FluentProvider, { theme: fusionTheme, style: { background: "transparent" } }, view);
  }

  private onAnswer = (questionId: string, value: string | undefined): void => {
    const next = { ...this.answers };
    if (value === undefined) delete next[questionId];
    else next[questionId] = value;
    this.answers = next;
    this.recalculate(true);
  };

  private recalculate(notify: boolean): void {
    this.result = evaluate(this.questions, this.rules, this.answers, this.criticality);
    if (notify) this.notifyOutputChanged();
  }

  public getOutputs(): IOutputs {
    const r = this.result;
    if (!r) return {};
    return {
      AnswersOut: JSON.stringify(answersOut(r, this.answers)),
      Score: r.score,
      Band: r.band,
      CriticalHit: r.criticalHit,
      AnsweredCount: r.answeredCount,
      VisibleCount: r.visible.length,
      ExplanationJson: JSON.stringify(r.lines.map((l) => ({ Kind: l.kind, Code: l.code, Label: l.label, Points: l.points, Critical: l.critical }))),
    };
  }

  public destroy(): void {
    // Nothing to clean up: no timers, listeners or remote calls.
  }
}
