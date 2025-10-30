import axios from "axios"

export const courseMaterialClient = axios.create({
  baseURL: "/api/v0/course-material",
  responseType: "json",
  headers: { "Content-Type": "application/json" },
})
