/* eslint-disable i18next/no-literal-string */

import { AxiosResponse } from "axios"

import { ErrorResponse } from "../bindings"

// usage: validateResponse(response, isOrganization)
// throws the response with an ErrorResponse if the data is invalid for useQuery to catch
export function validateResponse<T>(
  response: AxiosResponse<unknown, unknown>,
  isT: (x: unknown) => x is T,
): T {
  const data = response.data
  if (isT(data)) {
    return data
  } else {
    // alter the response data to contain an ErrorResponse
    const error: ErrorResponse = {
      title: "Invalid data from API",
      message: `Data: ${JSON.stringify(data, undefined, 2)}`,
      source: response.request?.responseURL,
    }
    response.data = error
    throw response
  }
}

// usage: validateResponse(response, isArray(isOrganization))
export function isArray<T>(isT: (x: unknown) => x is T): (x: unknown) => x is Array<T> {
  // ts doesn't understand this so we need the explicit cast
  return ((x) => Array.isArray(x) && x.every((i) => isT(i))) as (x: unknown) => x is Array<T>
}

export function isString(x: unknown): x is string {
  return typeof x === "string"
}

export function isNumber(x: unknown): x is number {
  return typeof x === "number"
}
