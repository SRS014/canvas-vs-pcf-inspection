// Minimal Dataverse Web API client: device-code sign-in, a token cache on disk,
// and a fetch wrapper that retries throttling and customization-lock errors.
import { PublicClientApplication } from "@azure/msal-node";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, "..");

// Microsoft's sample public client for Dataverse developer tooling.
// Override with DATAVERSE_CLIENT_ID if your tenant blocks it.
const CLIENT_ID = process.env.DATAVERSE_CLIENT_ID ?? "51f81489-12ee-4a9e-aaae-a2591f45987d";
const CACHE_FILE = join(root, ".auth", "msal-cache.json");

export function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

export function environmentUrl() {
  const arg = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
  const url = (arg ?? process.env.DATAVERSE_URL ?? "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.crm[0-9]*\.dynamics\.com$/i.test(url)) {
    throw new Error(
      "Set the environment URL, for example DATAVERSE_URL=https://yourorg.crm.dynamics.com (or pass --url=...)."
    );
  }
  return url;
}

const cachePlugin = {
  async beforeCacheAccess(ctx) {
    if (existsSync(CACHE_FILE)) ctx.tokenCache.deserialize(readFileSync(CACHE_FILE, "utf8"));
  },
  async afterCacheAccess(ctx) {
    if (!ctx.cacheHasChanged) return;
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, ctx.tokenCache.serialize());
  },
};

async function acquireToken(url) {
  if (process.env.DATAVERSE_TOKEN) return process.env.DATAVERSE_TOKEN;
  const pca = new PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: "https://login.microsoftonline.com/organizations" },
    cache: { cachePlugin },
  });
  const scopes = [`${url}/.default`];
  const [account] = await pca.getTokenCache().getAllAccounts();
  if (account) {
    try {
      return (await pca.acquireTokenSilent({ account, scopes })).accessToken;
    } catch {
      // Fall through to an interactive device-code sign-in.
    }
  }
  const result = await pca.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (r) => console.log(`\n${r.message}\n`),
  });
  return result.accessToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect({ solution } = {}) {
  const url = environmentUrl();
  const token = await acquireToken(url);
  const base = `${url}/api/data/v9.2/`;

  async function api(method, path, body, { allow404 = false, headers = {} } = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          ...(solution ? { "MSCRM.SolutionUniqueName": solution } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 404 && allow404) return null;
      const text = await res.text();
      if (res.ok) {
        const entityId = res.headers.get("OData-EntityId");
        const json = text ? JSON.parse(text) : {};
        if (entityId) json["@entityId"] = entityId.match(/\(([^)]+)\)$/)?.[1];
        return json;
      }
      const retryable = res.status === 429 || res.status >= 500 || /lock|concurrent/i.test(text);
      if (retryable && attempt < 6) {
        const wait = Number(res.headers.get("Retry-After") ?? 0) * 1000 || 2000 * attempt;
        console.warn(`  ${method} ${path} -> ${res.status}, retrying in ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      let message = text;
      try {
        message = JSON.parse(text).error.message;
      } catch {}
      throw new Error(`${method} ${path} failed (${res.status}): ${message}`);
    }
  }

  return { url, api };
}

export const label = (text) => ({
  "@odata.type": "Microsoft.Dynamics.CRM.Label",
  LocalizedLabels: [{ "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel", Label: text, LanguageCode: 1033 }],
});

export const logical = (schemaName) => schemaName.toLowerCase();
