// Backs up every inspection with its answers and full-size photos to a local folder, then checks
// the folder against Dataverse. Read-only: it changes nothing in the environment.
//   DATAVERSE_URL=https://yourorg.crm.dynamics.com node scripts/backup-inspections.mjs <folder>
// The folder holds real rows and images, so keep it out of git.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { acquireToken, connect, environmentUrl } from "./dataverse.mjs";

const IMAGE_COLUMNS = ["fp_photo", "fp_canvasstrokes", "fp_annotatedphoto"];
const ANNOTATED = { headers: { Prefer: 'odata.include-annotations="*"' } };

const folder = process.argv[2] && resolve(process.argv[2]);
if (!folder) throw new Error("Pass the backup folder.");
const imagesDir = join(folder, "images");
mkdirSync(imagesDir, { recursive: true });

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const extensionOf = (b) =>
  b[0] === 0x89 && b[1] === 0x50 ? "png" : b[0] === 0xff && b[1] === 0xd8 ? "jpg" : b[0] === 0x47 && b[1] === 0x49 ? "gif" : null;
// PNG and JPEG sizes from the file headers, so a thumbnail can't pass for the full image
function pixelSize(b) {
  if (b[0] === 0x89) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const { api } = await connect();
const url = environmentUrl();
const token = await acquireToken(url);

// Dataverse returns image $value either as raw bytes or as a base64 string. Rows saved before the
// column could store full images have only a thumbnail, and size=full answers 204 for those.
async function fetchImage(photoId, column, query) {
  const res = await fetch(`${url}/api/data/v9.2/fp_inspectionphotos(${photoId})/${column}/$value${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${column} of ${photoId}: HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  if (extensionOf(raw)) return raw;
  const decoded = Buffer.from(raw.toString("utf8").replace(/^"|"$/g, ""), "base64");
  if (extensionOf(decoded)) return decoded;
  throw new Error(`${column} of ${photoId}: not a recognised image (${raw.length} bytes)`);
}
async function downloadImage(photoId, column) {
  const full = await fetchImage(photoId, column, "?size=full");
  if (full) return { bytes: full, stored: "full" };
  const thumbnail = await fetchImage(photoId, column, "");
  if (thumbnail) return { bytes: thumbnail, stored: "thumbnail only" };
  throw new Error(`${column} of ${photoId}: no image data`);
}

const inspections = (await api("GET", "fp_inspections?$orderby=fp_name asc", undefined, ANNOTATED)).value;
const answers = (await api("GET", "fp_inspectionanswers", undefined, ANNOTATED)).value;
const photos = (await api("GET", "fp_inspectionphotos", undefined, ANNOTATED)).value;
writeFileSync(join(folder, "inspections.json"), JSON.stringify(inspections, null, 2));
writeFileSync(join(folder, "answers.json"), JSON.stringify(answers, null, 2));
writeFileSync(join(folder, "photos.json"), JSON.stringify(photos, null, 2));

const files = [];
for (const photo of photos) {
  for (const column of IMAGE_COLUMNS) {
    if (!photo[`${column}id`] && !photo[`${column}_url`]) continue;
    const { bytes, stored } = await downloadImage(photo.fp_inspectionphotoid, column);
    const file = `${photo.fp_inspectionphotoid}-${column}.${extensionOf(bytes)}`;
    writeFileSync(join(imagesDir, file), bytes);
    files.push({ file, photoId: photo.fp_inspectionphotoid, column, stored, inspection: photo._fp_inspection_value, bytes: bytes.length, sha256: sha256(bytes), ...pixelSize(bytes) });
  }
}
const manifest = { takenAt: new Date().toISOString(), inspections: inspections.length, answers: answers.length, photos: photos.length, files };
writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest, null, 2));

// Verify from disk, against a fresh read of Dataverse
const problems = [];
const onDisk = (name) => JSON.parse(readFileSync(join(folder, name), "utf8"));
const check = async (name, entitySet, key) => {
  const live = (await api("GET", `${entitySet}?$select=${key}`)).value.map((r) => r[key]).sort();
  const saved = onDisk(name).map((r) => r[key]).sort();
  if (JSON.stringify(live) !== JSON.stringify(saved)) problems.push(`${name}: rows differ from Dataverse (${saved.length} saved, ${live.length} live)`);
};
await check("inspections.json", "fp_inspections", "fp_inspectionid");
await check("answers.json", "fp_inspectionanswers", "fp_inspectionanswerid");
await check("photos.json", "fp_inspectionphotos", "fp_inspectionphotoid");
for (const f of onDisk("manifest.json").files) {
  const bytes = readFileSync(join(imagesDir, f.file));
  if (sha256(bytes) !== f.sha256) problems.push(`${f.file}: hash differs`);
  const again = await downloadImage(f.photoId, f.column);
  if (sha256(again.bytes) !== f.sha256) problems.push(`${f.file}: differs from a fresh download`);
}
for (const p of photos) {
  if ((p.fp_photoid || p.fp_photo_url) && !files.some((f) => f.photoId === p.fp_inspectionphotoid && f.column === "fp_photo")) problems.push(`${p.fp_inspectionphotoid}: photo missing from the backup`);
}

console.log(`Inspections ${inspections.length}, answers ${answers.length}, photo rows ${photos.length}, image files ${files.length}, ${(files.reduce((t, f) => t + f.bytes, 0) / 1e6).toFixed(1)} MB`);
for (const f of files) console.log(`  ${f.column.padEnd(18)} ${String(f.width)}x${String(f.height)}  ${f.bytes} bytes  ${f.stored}`);
console.log(problems.length ? `PROBLEMS:\n  ${problems.join("\n  ")}` : "Verified: rows match Dataverse, every image hash matches a fresh download.");
process.exit(problems.length ? 1 : 0);
