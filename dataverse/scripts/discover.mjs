// Lists the Dataverse environments your account can reach, with their current URLs,
// using the Global Discovery Service. Handy when an environment URL has changed.
//
//   npm run discover
import { acquireToken } from "./dataverse.mjs";

const GDS = "https://globaldisco.crm.dynamics.com";

async function main() {
  const token = await acquireToken(GDS);
  const res = await fetch(`${GDS}/api/discovery/v2.0/Instances?$select=FriendlyName,Url,EnvironmentId,State,Version`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Discovery failed (${res.status}): ${await res.text()}`);
  const { value } = await res.json();
  if (!value.length) console.log("No Dataverse environments found for this account.");
  for (const i of value) {
    console.log(`${i.FriendlyName.padEnd(40)} ${i.Url.padEnd(45)} env ${i.EnvironmentId}  state ${i.State}`);
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
