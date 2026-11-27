import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { validateGradingConfig } from "@/server/remoteSandbox/config"

validateGradingConfig()

export default createServerEntry({ fetch: (request) => handler.fetch(request) })
