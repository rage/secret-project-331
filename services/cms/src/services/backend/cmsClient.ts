import axios from "axios"

export const cmsClient = axios.create({
  baseURL: "/api/v0/cms",
  headers: { "Content-Type": "application/json" },
})
