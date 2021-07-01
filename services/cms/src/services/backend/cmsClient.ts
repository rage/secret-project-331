import axios from "axios"
import { ISOStringToDateTime } from "../../utils/dateUtil"

export const cmsClient = axios.create({ baseURL: "/api/v0/cms" })

cmsClient.interceptors.response.use(
  // Handles status code range 2xx
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  // Any status code that fall outside of the range 2xx
  (error) => {
    return Promise.reject(error.response)
  },
)
