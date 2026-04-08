import { client as generatedApiClient } from "@/generated/api/client.generated"
import type {
  GetPlaygroundViewsWebsocketData,
  ReceivePlaygroundGradingData,
} from "@/generated/api/types.generated"

const PLAYGROUND_VIEWS_WEBSOCKET_PATH: GetPlaygroundViewsWebsocketData["url"] =
  "/api/v0/main-frontend/playground-views/ws"
const PLAYGROUND_VIEWS_GRADING_PATH: ReceivePlaygroundGradingData["url"] =
  "/api/v0/main-frontend/playground-views/grading/{websocket_id}"

const toAbsoluteUrl = (url: string) =>
  generatedApiClient.buildUrl({
    baseUrl: window.location.origin,
    url,
  })

export const getPlaygroundViewsWebsocketUrl = (): string => {
  const httpUrl = new URL(toAbsoluteUrl(PLAYGROUND_VIEWS_WEBSOCKET_PATH))

  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:"

  return httpUrl.toString()
}

export const getPlaygroundViewsGradingCallbackUrl = (websocketId: string): string =>
  generatedApiClient.buildUrl({
    baseUrl: window.location.origin,
    path: {
      websocket_id: websocketId,
    },
    url: PLAYGROUND_VIEWS_GRADING_PATH,
  })
