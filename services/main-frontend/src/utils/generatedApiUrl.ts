import { client as generatedApiClient } from "@/generated/api/client.generated"

type PathParams = Record<string, string | number | boolean>

export const buildGeneratedApiUrl = (url: string, path?: PathParams): string =>
  generatedApiClient.buildUrl({
    baseUrl: window.location.origin,
    ...(path ? { path } : {}),
    url,
  })

export const buildGeneratedWebSocketUrl = (url: string): string => {
  const httpUrl = new URL(buildGeneratedApiUrl(url))

  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:"

  return httpUrl.toString()
}
