import { client as generatedApiClient } from "@/generated/api/client.generated"

type PathParams = Record<string, string | number | boolean>

type QueryParams = Record<string, unknown>

/**
 * Absolute URL for a generated endpoint, host and all.
 *
 * Only for a URL that has to survive leaving this page — an iframe src, a popup, a callback handed
 * to an exercise service. It reads `window`, so it cannot be called while rendering on the server;
 * for an href the browser resolves itself, use `buildGeneratedApiPath`.
 */
export const buildGeneratedApiUrl = (url: string, path?: PathParams): string =>
  generatedApiClient.buildUrl({
    baseUrl: window.location.origin,
    ...(path ? { path } : {}),
    url,
  })

/** Same-origin path for a generated endpoint, for an href or a fetch on this page. */
export const buildGeneratedApiPath = (
  url: string,
  path?: PathParams,
  query?: QueryParams,
): string =>
  generatedApiClient.buildUrl({
    ...(path ? { path } : {}),
    ...(query ? { query } : {}),
    url,
  })

export const buildGeneratedWebSocketUrl = (url: string): string => {
  const httpUrl = new URL(buildGeneratedApiUrl(url))

  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:"

  return httpUrl.toString()
}
