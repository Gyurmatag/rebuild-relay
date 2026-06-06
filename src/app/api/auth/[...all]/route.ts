import { getEnv } from "@/lib/cf";
import { createAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const env = await getEnv();
  const auth = createAuth(env);
  return auth.handler(request);
}

export { handler as GET, handler as POST };
