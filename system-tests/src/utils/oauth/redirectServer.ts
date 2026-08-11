import type http from "http"

import { setupRedirectServer } from "@/fixtures/oauth"

/**
 * Redirect URI for this worker's callback server. Must be called after ensureRedirectServer().
 */
export function getRedirectServerUri(boundPort: number | null): string {
  if (boundPort === null) {
    throw new Error("Redirect server not set up; call ensureServer() first")
  }
  return `http://127.0.0.1:${boundPort}/callback`
}

/**
 * Ensure this worker has its own callback server (one port in 8765..8784 per worker).
 */
export async function ensureServer(redirectServer: http.Server | null): Promise<void> {
  if (redirectServer) {
    return
  }
  await setupRedirectServer()
}
