import axios from "axios"

import { interceptor } from "../shared-module/services/backend/interceptor"

export const courseMaterialClient = axios.create({
  baseURL: "/api/v0/course-material",
  responseType: "json",
  headers: { "Content-Type": "application/json" },
})

interceptor(courseMaterialClient)
