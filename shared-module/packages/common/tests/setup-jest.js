import { ServerResponse } from "http"
import { TextEncoder } from "util"
global.TextEncoder = TextEncoder
global.Response = ServerResponse
