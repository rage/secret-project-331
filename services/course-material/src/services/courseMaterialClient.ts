import axios from "axios"
import { ISOStringToDateTime } from "../utils/dateUtil"

export const courseMaterialClient = axios.create({
  baseURL: "/api/v0/course-material",
})

courseMaterialClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)
