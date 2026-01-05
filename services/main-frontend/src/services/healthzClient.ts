import axios from "axios"

export const healthzClient = axios.create({
  baseURL: "/api/v0/health",
  responseType: "json",
  headers: { "Content-Type": "application/json" },
})
