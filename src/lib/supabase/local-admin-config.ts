type Env = Readonly<Record<string,string | undefined>>;

function localConnection(env: Env) {
  const url = env.SHARK_LOCAL_SUPABASE_URL ?? "";
  const publishableKey = env.SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(url) || Number(url.split(":").at(-1)) > 65535 ||
      !/^sb_publishable_[\w-]+$/.test(publishableKey)) return null;
  return { url, publishableKey };
}
export function localAdminConfig(env: Env = process.env) {
  const academy = env.SHARK_LOCAL_ACADEMY_ID ?? "";
  const config = env.SHARK_LOCAL_ADMIN === "1" && localConnection(env);
  if (!config || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(academy)) return null;
  return { ...config, academy };
}
export function localParentConfig(env: Env = process.env) {
  return env.SHARK_LOCAL_PARENT === "1" ? localConnection(env) : null;
}
const localCookies = { sameSite: "lax", httpOnly: true, secure: false } as const;
export const localAdminCookies = { ...localCookies, name: "shark-local-admin", path: "/admin" } as const;
export const localParentCookies = { ...localCookies, name: "shark-local-parent", path: "/parent" } as const;


export const previewBranch = "preview/academy-dev";
const developmentUrl = "https://dzepxtynubzhwmcezvvp.supabase.co";
function onVercel(env: Env) { return !!(env.VERCEL || env.VERCEL_ENV || env.VERCEL_TARGET_ENV); }
function previewConnection(env: Env) {
  const url = env.SHARK_PREVIEW_SUPABASE_URL;
  const publishableKey = env.SHARK_PREVIEW_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" ||
      (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
      env.VERCEL_GIT_COMMIT_REF !== previewBranch ||
      env.SHARK_PREVIEW_ENABLED !== "1" || url !== developmentUrl ||
      !/^sb_publishable_[\w-]+$/.test(publishableKey)) return null;
  return { url, publishableKey };
}
export function workspaceAdminConfig(env: Env = process.env) {
  if (!onVercel(env)) return localAdminConfig(env);
  const academy = env.SHARK_PREVIEW_ACADEMY_ID ?? "";
  const config = previewConnection(env);
  if (!config || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(academy)) return null;
  return {...config,academy};
}
export function workspaceParentConfig(env: Env = process.env) {
  return onVercel(env) ? previewConnection(env) : localParentConfig(env);
}
export function workspaceCookies(role: "admin" | "parent", env: Env = process.env) {
  const options = role === "admin" ? localAdminCookies : localParentCookies;
  return onVercel(env) ? {...options,name:"shark-preview-"+role,secure:true} : options;
}
