import axios from "axios"

export const filesClient = axios.create({ baseURL: "/api/v0/files" })
