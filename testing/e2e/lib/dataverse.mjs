// Dataverse checks for the e2e tests: reads what the app wrote and removes the rows a test created.
// Reuses the provisioning scripts' Web API client and token cache.
import { DATAVERSE_URL } from "./env.mjs";

process.env.DATAVERSE_URL ??= DATAVERSE_URL;
const { connect } = await import("../../../dataverse/scripts/dataverse.mjs");
let client;
const api = async (...args) => (client ??= await connect()).api(...args);
const FV = "@OData.Community.Display.V1.FormattedValue";
const ANN = { headers: { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' } };

export async function inspection(number) {
  const r = await api("GET", `fp_inspections?$select=fp_name,fp_status,fp_riskscore,fp_riskband,fp_builtwith,fp_submittedon&$filter=fp_name eq '${number}'`, undefined, ANN);
  const i = r.value[0];
  return i && { id: i.fp_inspectionid, number: i.fp_name, score: i.fp_riskscore, status: i[`fp_status${FV}`], band: i[`fp_riskband${FV}`], builtWith: i[`fp_builtwith${FV}`], submittedOn: i.fp_submittedon };
}
export async function answers(inspectionId) {
  const r = await api("GET", `fp_inspectionanswers?$select=fp_name,fp_value,fp_riskcontribution&$filter=_fp_inspection_value eq ${inspectionId}`);
  return r.value.map((a) => ({ code: a.fp_name, value: a.fp_value, points: a.fp_riskcontribution }));
}
export async function answerExists(value) {
  const r = await api("GET", `fp_inspectionanswers?$select=fp_name&$top=1&$filter=fp_value eq '${value.replace(/'/g, "''")}'`);
  return r.value.length > 0;
}
export async function photos(inspectionId) {
  const r = await api("GET", `fp_inspectionphotos?$select=fp_name,fp_photo_url,fp_canvasstrokes_url,fp_annotatedphoto_url,fp_annotationjson&$filter=_fp_inspection_value eq ${inspectionId}`);
  return r.value.map((p) => ({ caption: p.fp_name, hasPhoto: !!p.fp_photo_url, hasStrokes: !!p.fp_canvasstrokes_url, hasAnnotated: !!p.fp_annotatedphoto_url, annotationJson: p.fp_annotationjson }));
}
export async function counts() {
  const r = await api("GET", "fp_inspections?$select=fp_status&$top=5000", undefined, ANN);
  const by = (s) => r.value.filter((i) => i[`fp_status${FV}`] === s).length;
  return { total: r.value.length, drafts: by("Draft"), submitted: by("Submitted") };
}
// Deletes exactly the inspections a test created, by number. Answers and photos cascade.
export async function removeInspections(numbers) {
  for (const n of numbers) {
    const i = await inspection(n);
    if (i) await api("DELETE", `fp_inspections(${i.id})`);
  }
}
