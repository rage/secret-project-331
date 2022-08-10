import { AxiosError, AxiosInstance, AxiosResponse } from "axios"

import { ISOStringToDateTime } from "../../utils/dateUtil"

export const interceptor = (axiosClient: AxiosInstance): AxiosResponse<unknown> | number => {
  return axiosClient.interceptors.response.use(
    (response: AxiosResponse) => {
      ISOStringToDateTime(response.data)
      return response
    },
    // Any status code that fall outside of the range 2xx
    // Rejects the response for useQuery to catch
    (err: AxiosError) => {
      return Promise.reject(err.response)
    },
  )
}
