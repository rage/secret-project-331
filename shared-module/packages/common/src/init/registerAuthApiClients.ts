import {
  appApiErrorFromHttpFailure,
  appApiErrorFromTransportFailure,
  isAppApiError,
} from "../errors/AppApiError"
import { client as authApiClient } from "../generated/auth-api/client.generated"

let authApiClientRegistered = false

/** Registers canonical API error interceptors for auth generated clients. */
export function registerAuthApiClients(): void {
  if (authApiClientRegistered) {
    return
  }

  authApiClient.interceptors.error.use((error, response, request) => {
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

  authApiClientRegistered = true
}

registerAuthApiClients()
