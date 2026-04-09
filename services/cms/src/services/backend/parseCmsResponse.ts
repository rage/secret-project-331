import type { AxiosResponse } from "axios"
import type { ZodType } from "zod"

import type { ErrorResponse } from "@/shared-module/common/errorApiTypes"

export function parseCmsResponse<T>(
  response: AxiosResponse<unknown, unknown>,
  schema: ZodType<T>,
): T {
  const parsed = schema.safeParse(response.data)
  if (parsed.success) {
    return parsed.data
  }

  const error: ErrorResponse = {
    title: "Invalid data from API",
    message: JSON.stringify(parsed.error.format(), undefined, 2),
    source: response.request?.responseURL,
    data: null,
  }
  response.data = error
  response.status = 422
  throw response
}
