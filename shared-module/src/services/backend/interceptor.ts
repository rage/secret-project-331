import axios from "axios"

import { ISOStringToDateTime } from "../../utils/dateUtil"

export const courseMaterialClient = axios.create({
  baseURL: "/api/v0/course-material",
})

courseMaterialClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  // Any status code that fall outside of the range 2xx
  (err) => Promise.reject(err),
)
