import axios from "axios"
import { ISOStringToDateTime } from "../utils/dateUtil"

export const mainFrontendClient = axios.create({ baseURL: "/api/v0/main-frontend" })

mainFrontendClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)
