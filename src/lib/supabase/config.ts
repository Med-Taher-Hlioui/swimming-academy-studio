export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new Error("Set both Supabase public environment variables in .env.local.");
  }

  if (url !== "https://dzepxtynubzhwmcezvvp.supabase.co") {
    throw new Error("Academy OS development must target the designated academy-os-dev project.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Use a modern Supabase publishable key for the development client.");
  }

  return { url, publishableKey };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase development environment variables are missing.");
  return config;
}
