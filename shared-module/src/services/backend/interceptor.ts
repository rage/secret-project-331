import { AxiosInstance, AxiosResponse } from "axios"

import { ISOStringToDateTime } from "../../utils/dateUtil"

export const interceptor = (axiosClient: AxiosInstance): AxiosResponse<unknown> | number => {
  return axiosClient.interceptors.response.use(
    (response) => {
      ISOStringToDateTime(response.data)
      return response
    },
    // Any status code that fall outside of the range 2xx
    (err) => Promise.reject(err),
  )
}
