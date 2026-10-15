import { client as cmsApiClient } from "@/generated/api/client.generated"
import {
  appApiErrorFromHttpFailure,
  appApiErrorFromTransportFailure,
  isAppApiError,
} from "@/shared-module/common/errors/AppApiError"

let cmsClientsRegistered = false

/** Registers canonical API error interceptors for CMS generated clients. */
export function registerCmsApiClients(): void {
  if (cmsClientsRegistered) {
    return
  }

  cmsApiClient.interceptors.error.use((error, response, request) => {
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
    return appApiErrorFromTransportFailure({
      error,
      request: request instanceof Request ? request : null,
    })
  })

  cmsClientsRegistered = true
}

registerCmsApiClients()
