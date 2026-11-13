import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { getSupabaseConfig, requireSupabaseConfig } from "../src/lib/supabase/config";

let originalUrl: string | undefined;
let originalKey: string | undefined;

beforeEach(() => {
  originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

test("an unconfigured deployment keeps demo mode available", () => {
  assert.equal(getSupabaseConfig(), null);
  assert.throws(requireSupabaseConfig, /missing/);
});

test("partial configuration fails without echoing credential values", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://dzepxtynubzhwmcezvvp.supabase.co";
  assert.throws(getSupabaseConfig, /both/);
});

test("development configuration rejects another project and privileged key types", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_unit_test_fixture";
  assert.throws(getSupabaseConfig, /designated/);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://dzepxtynubzhwmcezvvp.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_unit_test_fixture";
  assert.throws(getSupabaseConfig, /publishable/);
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_unit_test_fixture";
  assert.equal(requireSupabaseConfig().url, process.env.NEXT_PUBLIC_SUPABASE_URL);
});
