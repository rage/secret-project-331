import { client as mainApiClient } from "@/generated/api/client.generated"
import { client as courseMaterialApiClient } from "@/generated/course-material-api/client.generated"
import {
  AppApiError,
  appApiErrorFromHttpFailure,
  appApiErrorFromTransportFailure,
  isAppApiError,
} from "@/shared-module/common/errors/AppApiError"

let mainFrontendClientsRegistered = false

/** Registers canonical API error interceptors for generated clients. */
export function registerMainFrontendApiClients(): void {
  if (mainFrontendClientsRegistered) {
    return
  }

  const attach = (client: typeof mainApiClient) => {
    client.interceptors.error.use((error, response, request) => {
      if (isAppApiError(error)) {
        return error
      }
      if (response instanceof Response && request instanceof Request) {
        return appApiErrorFromHttpFailure({
          body: error,
          response,
          request,
        })
      }
      const fallback = appApiErrorFromTransportFailure({
        error,
        request: request instanceof Request ? request : null,
      })
      return fallback
    })
  }

  attach(mainApiClient)
  attach(courseMaterialApiClient)

  mainFrontendClientsRegistered = true
}

registerMainFrontendApiClients()

export type MainFrontendApiError = AppApiError
