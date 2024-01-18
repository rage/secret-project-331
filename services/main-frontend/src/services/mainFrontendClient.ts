import axios from "axios"

export const mainFrontendClient = axios.create({
  baseURL: "/api/v0/main-frontend",
  responseType: "json",
  headers: { "Content-Type": "application/json" },
})
