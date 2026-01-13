import { AxiosError } from "axios"

import { ErrorResponse } from "../../bindings"
import { isErrorData, isErrorResponse } from "../../bindings.guard"

export interface ParsedError {
  title: string
  message?: string
  sourceData?: unknown
  linkBlockId?: string
  status?: number
}

/**
 * Parses an unknown error value into a structure suitable for rendering.
 */
export async function parseError(error: unknown, defaultTitle: string): Promise<ParsedError> {
  if (typeof error === "string") {
    return {
      title: defaultTitle,
      message: error,
    }
  }

  if (typeof error === "object" && error !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let err = error as any

    if (err.data instanceof Blob || (err.data && typeof err.data.text === "function")) {
      const blob: { text: () => Promise<string> } = err.data
      const text = await blob.text()
      try {
        const parsed = JSON.parse(text)
        err = { ...err, data: parsed }
      } catch {
        err = { ...err, data: text }
      }
    }

    if (isErrorResponse(err.data)) {
      const data: ErrorResponse = err.data
      const errorData = data.data
      return {
        title: data.title,
        message: data.message,
        sourceData: data.source,
        linkBlockId: isErrorData(errorData) ? errorData.block_id : undefined,
        status: typeof err.status === "number" ? err.status : undefined,
      }
    }

    if (err.isAxiosError) {
      const axiosError = err as AxiosError
      const responseData = axiosError.response?.data ?? err.data
      if (isErrorResponse(responseData)) {
        const errorData = responseData.data
        return {
          title: responseData.title,
          message: responseData.message,
          sourceData: responseData.source,
          linkBlockId: isErrorData(errorData) ? errorData.block_id : undefined,
          status:
            typeof axiosError.response?.status === "number"
              ? axiosError.response?.status
              : undefined,
        }
      }
      const responseMessage =
        typeof responseData === "object" && responseData !== null && "message" in responseData
          ? (responseData as { message: string }).message
          : undefined

      return {
        title: axiosError.message,
        message: responseMessage,
        sourceData: responseData,
      }
    }

    if (
      err.status !== undefined &&
      err.statusText !== undefined &&
      typeof err.request === "object" &&
      err.request.responseURL !== undefined
    ) {
      return {
        title: err.statusText,
        message: err.request.responseURL,
        sourceData: err.data,
        status: err.status,
      }
    }

    if (
      err instanceof Error ||
      (typeof err.message === "string" && typeof err.stack === "string")
    ) {
      const normalized: { message?: string; stack?: string } = err
      return {
        title: normalized.message ?? defaultTitle,
        sourceData: `${String(normalized.message ?? "")}\n${normalized.stack ?? ""}`,
      }
    }
  }

  return {
    title: defaultTitle,
    sourceData: error,
  }
}
