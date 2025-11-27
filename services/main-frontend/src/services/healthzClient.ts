import axios from "axios"

export const healthzClient = axios.create({
  baseURL: "/api/v0/healthz",
  responseType: "json",
  headers: { "Content-Type": "application/json" },
})
