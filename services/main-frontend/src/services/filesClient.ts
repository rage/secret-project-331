import axios from "axios"

import { interceptor } from "../shared-module/services/backend/interceptor"

export const filesClient = axios.create({ baseURL: "/api/v0/files" })

interceptor(filesClient)
