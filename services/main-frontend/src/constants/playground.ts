import { isServer } from "@tanstack/react-query"

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin
export const DEFAULT_SERVICE_INFO_URL = `${PUBLIC_ADDRESS}/example-exercise/api/service-info`
