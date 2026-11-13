#!/usr/bin/env node
/**
 * Static and lightweight checks for the research-step JWT hardening.
 * Run from the repo root or from v3/goal_ui:
 *   node v3/goal_ui/scripts/check-supabase-hardening.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const goalUi = resolve(here, "..");
const failures = [];

function read(rel) {
  return readFileSync(resolve(goalUi, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const config = read("supabase/config.toml");
const researchBlock = config.split("[functions.research-step]")[1]?.split("[")[0] ?? "";
assert(researchBlock.includes("verify_jwt = true"), "config.toml research-step must set verify_jwt = true");
assert(!researchBlock.includes("verify_jwt = false"), "config.toml research-step must not set verify_jwt = false");

const client = read("src/integrations/supabase/client.ts");
assert(client.includes("import.meta.env.VITE_SUPABASE_URL"), "client.ts must read VITE_SUPABASE_URL");
assert(
  client.includes("VITE_SUPABASE_PUBLISHABLE_KEY") && client.includes("VITE_SUPABASE_ANON_KEY"),
  "client.ts must read publishable or anon env vars"
);
assert(client.includes("throw new Error"), "client.ts must fail closed when env vars are missing");
assert(!/eyJ[A-Za-z0-9_\-]{10,}\./.test(client), "client.ts must not contain a hard-coded JWT");
assert(!client.includes("eqzmqxtngbulzhimrymr"), "client.ts must not hard-code the project URL");

const helper = read("src/integrations/supabase/invokeAuthed.ts");
assert(helper.includes("getSession()"), "invokeAuthed.ts must require a session");
assert(helper.includes("Authorization"), "invokeAuthed.ts must send the user JWT");
assert(helper.includes("You must be signed in"), "invokeAuthed.ts must fail closed without a session");

const fn = read("supabase/functions/research-step/index.ts");
assert(fn.includes("auth.getUser("), "research-step must call auth.getUser()");
assert(fn.includes("requireSignedInUser"), "research-step must run requireSignedInUser");
assert(fn.includes("status: 401"), "research-step must return 401 when unauthenticated");
assert(fn.includes("SUPABASE_URL"), "research-step must read SUPABASE_URL");
assert(
  fn.includes("SUPABASE_ANON_KEY") && fn.includes("SUPABASE_PUBLISHABLE_KEY"),
  "research-step must read SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY"
);
assert(!/eyJ[A-Za-z0-9_\-]{10,}\./.test(fn), "research-step must not contain a hard-coded JWT");

const index = read("src/pages/Index.tsx");
assert(index.includes("invokeAuthedFunction('research-step'"), "Index.tsx must call invokeAuthedFunction for research-step");
assert(!index.includes("supabase.functions.invoke('research-step'"), "Index.tsx must not call research-step without a session check");

const exampleEnv = read("example.env");
assert(!/eyJ[A-Za-z0-9_\-]{10,}\./.test(exampleEnv), "example.env must not contain a hard-coded JWT");
assert(exampleEnv.includes("VITE_SUPABASE_PUBLISHABLE_KEY"), "example.env must document the publishable key");

if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("PASS: supabase JWT hardening checks (%s checks conceptually ok)", "config, client, helper, function, callers, example.env");
