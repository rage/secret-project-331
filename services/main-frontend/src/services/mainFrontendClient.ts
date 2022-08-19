import axios from "axios"

import { interceptor } from "../shared-module/services/backend/interceptor"

export const mainFrontendClient = axios.create({
  baseURL: "/api/v0/main-frontend",
  responseType: "json",
})

interceptor(mainFrontendClient)
