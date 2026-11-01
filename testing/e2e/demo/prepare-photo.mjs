// Makes a clean copy of the photo dropped in this folder, for upload to the app: re-encoded with all
// metadata removed, then checked. The original isn't changed, and neither file goes in git.
//   node demo/prepare-photo.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { ROOT } from "../lib/env.mjs";

const DEMO = join(ROOT, "demo");
const photos = readdirSync(DEMO).filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f));
if (photos.length !== 1) throw new Error(`Expected one photo in demo/, found ${photos.length}: ${photos.join(", ")}`);
mkdirSync(join(DEMO, "out"), { recursive: true });
const clean = join(DEMO, "out", "photo-clean.jpg");

execFileSync(ffmpeg, ["-y", "-v", "error", "-i", join(DEMO, photos[0]), "-map_metadata", "-1", "-vf", "scale='min(1600,iw)':-2", "-q:v", "3", clean]);

const bytes = readFileSync(clean);
const found = ["Exif", "GPS", "XMP", "http://ns.adobe.com"].filter((marker) => bytes.includes(marker));
if (found.length) throw new Error(`Metadata still present in the clean copy: ${found.join(", ")}`);
const source = readFileSync(join(DEMO, photos[0]));
console.log(`${photos[0]}: original ${source.includes("GPS") ? "had" : "showed no"} GPS marker. Clean copy has no Exif, GPS or XMP: ${clean}`);
