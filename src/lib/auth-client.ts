"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client. Defaults to same-origin /api/auth. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
