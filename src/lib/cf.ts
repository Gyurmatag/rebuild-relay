import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Resolve the Cloudflare environment (bindings + vars + secrets) from inside a
 * Next.js route handler or server component running on OpenNext/Workers.
 *
 * Bindings such as `DB` (D1) and `AUDIO_BUCKET` (R2) are only available here —
 * `process.env` exposes plain vars and secrets but never bindings.
 */
export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

/**
 * Read a string config value, preferring the Cloudflare env (vars/secrets) and
 * falling back to `process.env` so the same code works under `next dev`.
 * Secrets are not present in the generated `CloudflareEnv` type, so the key is
 * intentionally a plain string.
 */
export function readVar(env: CloudflareEnv, key: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[key];
  if (typeof value === "string" && value.length > 0) return value;
  const fromProcess = process.env[key];
  return fromProcess && fromProcess.length > 0 ? fromProcess : undefined;
}

/**
 * Derive the publicly reachable origin for the deployment from the incoming
 * request, falling back to the configured PUBLIC_BASE_URL. Used to build
 * absolute callback URLs (Twilio status callbacks, recording callbacks).
 */
export function resolveBaseUrl(request: Request, env: CloudflareEnv): string {
  const configured = readVar(env, "PUBLIC_BASE_URL");
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
