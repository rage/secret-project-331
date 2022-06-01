/* eslint-disable i18next/no-literal-string */

import { AxiosResponse } from "axios"

import { ErrorResponse } from "../bindings"

// usage: validateResponse(response, isOrganization)
// checks the data in an axios response with the given guard and only returns the data if its type is correct
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
      data: null,
    }
    response.data = error
    response.status = 422
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

export function isNull(x: unknown): x is null {
  return x === null
}

// usage: validateResponse(response, isUnion(isOrganization, isNull))
export function isUnion<T, U>(
  isT: (x: unknown) => x is T,
  isU: (x: unknown) => x is U,
): (x: unknown) => x is T | U {
  // ts doesn't understand this so we need the explicit cast
  return ((x) => isT(x) || isU(x)) as (x: unknown) => x is T | U
}
