// Makes a clean copy of a photo dropped in this folder, for upload to the app: re-encoded with all
// metadata removed, then checked. The original isn't changed, and neither file goes in git.
//   node demo/prepare-photo.mjs [file]    (the file name is needed when there's more than one)
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { ROOT } from "../lib/env.mjs";

const DEMO = join(ROOT, "demo");
const photos = process.argv[2] ? [process.argv[2]] : readdirSync(DEMO).filter((f) => /\.(jpe?g|jfif|png|heic|webp)$/i.test(f));
if (photos.length !== 1) throw new Error(`Name the photo to use. Found ${photos.length}: ${photos.join(", ")}`);
mkdirSync(join(DEMO, "out"), { recursive: true });
const clean = join(DEMO, "out", "photo-clean.jpg");

execFileSync(ffmpeg, ["-y", "-v", "error", "-i", join(DEMO, photos[0]), "-map_metadata", "-1", "-vf", "scale='min(1600,iw)':-2", "-q:v", "3", clean]);

const bytes = readFileSync(clean);
// Metadata lives in JPEG APP segments, so read those rather than searching the image data
const segments = [];
for (let i = 2; i < bytes.length - 4 && bytes[i] === 0xff && bytes[i + 1] !== 0xda; i += 2 + bytes.readUInt16BE(i + 2)) {
  const name = bytes.subarray(i + 4, i + 2 + bytes.readUInt16BE(i + 2)).toString("latin1");
  if (bytes[i + 1] >= 0xe1 && bytes[i + 1] <= 0xef) segments.push(name.slice(0, 12));
}
if (segments.length) throw new Error(`Metadata still present in the clean copy: ${segments.join(", ")}`);
console.log(`${photos[0]}: clean copy has no metadata segments: ${clean}`);
