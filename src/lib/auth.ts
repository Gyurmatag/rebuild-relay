import { betterAuth } from "better-auth";
import { D1Dialect } from "kysely-d1";

import { readVar } from "@/lib/cf";

/**
 * Build a Better Auth instance bound to the current request's D1 database.
 * Created per request because Cloudflare bindings are only available then.
 */
export function createAuth(env: CloudflareEnv) {
  const baseURL = readVar(env, "PUBLIC_BASE_URL");
  return betterAuth({
    appName: "Rebuild Relay",
    database: {
      dialect: new D1Dialect({ database: env.DB }),
      type: "sqlite",
    },
    secret: readVar(env, "BETTER_AUTH_SECRET") ?? "dev-only-insecure-secret-change-me",
    ...(baseURL ? { baseURL } : {}),
    trustedOrigins: [baseURL, "http://localhost:3000"].filter(Boolean) as string[],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
  });
}
