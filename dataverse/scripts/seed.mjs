// Loads sites, equipment and the checklist templates. Upserts by natural key
// (site code, asset tag, question code), so it is safe to re-run.
//
//   npm run validate                                   (offline check of the seed files)
//   DATAVERSE_URL=https://yourorg.crm.dynamics.com npm run seed
import { connect, logical, readJson } from "./dataverse.mjs";

const schema = readJson("schema.json");
const ref = readJson("seed/reference-data.json");
const { questions } = readJson("seed/checklist-questions.json");

const choice = (optionSet, text) => {
  const os = schema.optionSets.find((o) => o.name === optionSet);
  const opt = os.options.find((o) => o.label === text);
  if (!opt) throw new Error(`"${text}" is not an option of ${optionSet}`);
  return opt.value;
};

// Depth, sort order and structural checks, done before anything touches Dataverse.
function prepareQuestions() {
  const byCode = new Map(questions.map((q) => [q.code, q]));
  const problems = [];
  questions.forEach((q, i) => {
    q.sortOrder = (i + 1) * 10;
    let depth = 0;
    for (let p = q.parent; p; p = byCode.get(p)?.parent) {
      if (!byCode.has(p)) problems.push(`${q.code}: parent ${p} not found`);
      if (++depth > 50) {
        problems.push(`${q.code}: parent chain loops`);
        break;
      }
    }
    q.depth = depth;
    if (q.parent && !q.show) problems.push(`${q.code}: has a parent but no show condition`);
    const parent = byCode.get(q.parent);
    if (parent?.answer === "Choice" && q.show) {
      const allowed = parent.options.split("|");
      for (const v of q.show.value.split("|")) {
        if (!allowed.includes(v)) problems.push(`${q.code}: show value "${v}" is not an option of ${parent.code}`);
      }
    }
    if (parent?.answer === "Yes/No" && q.show && !["Yes", "No"].includes(q.show.value)) {
      problems.push(`${q.code}: Yes/No parent needs Yes or No`);
    }
    for (const leaf of JSON.stringify(q.rule ?? {}).match(/"q":"[^"]+"/g) ?? []) {
      const code = leaf.slice(5, -1);
      if (!byCode.has(code)) problems.push(`${q.code}: rule references unknown question ${code}`);
    }
    try {
      choice("fp_inspectionstage", q.stage);
      choice("fp_answertype", q.answer);
      choice("fp_equipmenttype", q.type);
      if (q.show) choice("fp_conditionoperator", q.show.op);
      if (q.risk) choice("fp_conditionoperator", q.risk.op);
    } catch (e) {
      problems.push(`${q.code}: ${e.message}`);
    }
  });
  if (new Set(questions.map((q) => q.code)).size !== questions.length) problems.push("Duplicate question codes");
  return problems;
}

function report() {
  for (const type of ["Forklift", "Conveyor"]) {
    const set = questions.filter((q) => q.type === type);
    const maxDepth = Math.max(...set.map((q) => q.depth));
    console.log(
      `${type}: ${set.length} questions, ${set.filter((q) => !q.parent).length} root, ` +
        `deepest level ${maxDepth + 1}, ${set.filter((q) => q.critical).length} critical, ` +
        `${set.filter((q) => q.rule).length} cross-question rule(s)`
    );
  }
}

async function main() {
  const problems = prepareQuestions();
  if (problems.length) {
    console.error(`Seed data has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  report();
  if (process.argv.includes("--validate-only")) {
    console.log("Seed files are valid.");
    return;
  }

  const { url, api } = await connect();
  console.log(`Connected to ${url}`);

  const meta = {};
  for (const t of schema.tables) {
    const name = logical(t.schemaName);
    meta[name] = (await api("GET", `EntityDefinitions(LogicalName='${name}')?$select=EntitySetName,PrimaryIdAttribute`));
  }
  const nav = {};
  for (const r of schema.relationships) {
    const rel = await api("GET", `RelationshipDefinitions(SchemaName='${r.schemaName}')/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=ReferencingEntityNavigationPropertyName`);
    nav[r.schemaName] = rel.ReferencingEntityNavigationPropertyName;
  }
  const bind = (rel, table, id) => ({ [`${nav[rel]}@odata.bind`]: `/${meta[table].EntitySetName}(${id})` });

  async function upsert(table, keyColumn, keyValue, body) {
    const { EntitySetName: set, PrimaryIdAttribute: idCol } = meta[table];
    const found = (await api("GET", `${set}?$select=${idCol}&$filter=${keyColumn} eq '${keyValue.replace(/'/g, "''")}'`)).value[0];
    if (found) {
      await api("PATCH", `${set}(${found[idCol]})`, body);
      return found[idCol];
    }
    return (await api("POST", set, body))["@entityId"];
  }

  const siteIds = {};
  for (const s of ref.sites) {
    siteIds[s.code] = await upsert("fp_site", "fp_sitecode", s.code, { fp_name: s.name, fp_sitecode: s.code, fp_region: s.region });
  }
  console.log(`Sites: ${ref.sites.length}`);

  for (const e of ref.equipment) {
    await upsert("fp_equipment", "fp_assettag", e.assetTag, {
      fp_name: e.name,
      fp_assettag: e.assetTag,
      fp_equipmenttype: choice("fp_equipmenttype", e.type),
      fp_criticality: choice("fp_criticality", e.criticality),
      fp_hourmeter: e.hourMeter,
      ...bind("fp_site_equipment", "fp_site", siteIds[e.site]),
    });
  }
  console.log(`Equipment: ${ref.equipment.length}`);

  const questionIds = {};
  for (const q of questions) {
    questionIds[q.code] = await upsert("fp_checklistquestion", "fp_code", q.code, {
      fp_name: q.text,
      fp_code: q.code,
      fp_equipmenttype: choice("fp_equipmenttype", q.type),
      fp_stage: choice("fp_inspectionstage", q.stage),
      fp_sortorder: q.sortOrder,
      fp_depth: q.depth,
      fp_answertype: choice("fp_answertype", q.answer),
      fp_options: q.options ?? null,
      fp_showoperator: q.show ? choice("fp_conditionoperator", q.show.op) : null,
      fp_showvalue: q.show?.value ?? null,
      fp_riskweight: q.risk?.weight ?? 0,
      fp_riskoperator: q.risk ? choice("fp_conditionoperator", q.risk.op) : null,
      fp_riskvalue: q.risk?.value ?? null,
      fp_iscritical: !!q.critical,
      fp_rulejson: q.rule ? JSON.stringify(q.rule) : null,
      fp_helptext: q.help ?? null,
    });
  }
  const { EntitySetName: qSet } = meta.fp_checklistquestion;
  for (const q of questions.filter((q) => q.parent)) {
    await api("PATCH", `${qSet}(${questionIds[q.code]})`, bind("fp_question_parent", "fp_checklistquestion", questionIds[q.parent]));
  }
  console.log(`Checklist questions: ${questions.length} (parent links set)`);
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
