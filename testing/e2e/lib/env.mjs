// Shared settings for the e2e tests, the login helper and the demo recorder.
// Tenant-specific values come from ../../local.config.json (git-ignored; see local.config.example.json).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_FILE = join(ROOT, "..", "..", "local.config.json");
if (!existsSync(CONFIG_FILE)) throw new Error("Copy local.config.example.json to local.config.json and fill in your tenant's values.");
const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));

// Dedicated Chromium profile that keeps the Power Apps sign-in between runs (git-ignored).
// E2E_PROFILE_DIR lets several projects share one signed-in profile.
export const PROFILE_DIR = process.env.E2E_PROFILE_DIR ?? join(ROOT, ".auth", "profile");
export const ENV_ID = config.environmentId;
export const APP_IDS = { app1: config.app1Id, app2: config.app2Id };
export const TENANT_ID = config.tenantId;
export const LOGIN_HINT = process.env.E2E_LOGIN ?? config.loginHint;
export const DATAVERSE_URL = process.env.DATAVERSE_URL ?? config.dataverseUrl;
export const playUrl = (app, params = {}) => {
  const q = new URLSearchParams({ tenantId: TENANT_ID, hidenavbar: "true", ...params });
  return `https://apps.powerapps.com/play/e/${ENV_ID}/a/${APP_IDS[app]}?${q}`;
};
