import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("CMS targets the Air Express repository and main branch", async () => {
  const config = await read("admin/config.yml");

  assert.match(config, /^\s*repo:\s*AIREXPRESS96\/air-express-hvac\s*$/m);
  assert.match(config, /^\s*branch:\s*main\s*$/m);
  assert.doesNotMatch(config, /CryptoJym\/air-express-hvac/);
});

test("CMS page has no obsolete branch or hosted gateway instructions", async () => {
  const page = await read("admin/index.html");

  assert.doesNotMatch(page, /feat\/mobile-image-overhaul/);
  assert.doesNotMatch(page, /hosted git-gateway bridge/i);
  assert.match(page, /self-hosted OAuth proxy/i);
});

test("OAuth handoff documentation names the Air Express owner", async () => {
  const instructions = await read("admin/OAUTH_SETUP.md");

  assert.match(instructions, /AIREXPRESS96\/air-express-hvac/);
  assert.match(instructions, /transfer the existing[\s\S]*OAuth app[\s\S]*AIREXPRESS96/i);
  assert.doesNotMatch(instructions, /CryptoJym\/air-express-hvac/);
});
