import axios from "axios"

import { interceptor } from "../../shared-module/services/backend/interceptor"

export const cmsClient = axios.create({ baseURL: "/api/v0/cms" })

interceptor(cmsClient)
