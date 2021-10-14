import { AxiosError, AxiosInstance, AxiosResponse } from "axios"

import { ErrorResponse } from "../../bindings"
import { isErrorResponse } from "../../bindings.guard"
import { ISOStringToDateTime } from "../../utils/dateUtil"

export const interceptor = (axiosClient: AxiosInstance): AxiosResponse<unknown> | number => {
  return axiosClient.interceptors.response.use(
    (response: AxiosResponse) => {
      ISOStringToDateTime(response.data)
      return response
    },
    // Any status code that fall outside of the range 2xx
    (err: AxiosError) => {
      if (err.response && isErrorResponse(err.response.data)) {
        // errors from the server contain a response in the ErrorResponse format
        return Promise.reject(err.response.data)
      } else {
        // other errors are converted to ErrorResponses for convenience so the rest of the codebase can assume the format
        const unexpected: ErrorResponse = {
          title: err.name,
          message: err.message,
          source: null,
        }
        return Promise.reject(unexpected)
      }
    },
  )
}
