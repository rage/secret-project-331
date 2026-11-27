import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { gradingSandboxMode, validateGradingConfig } from "@/server/remoteSandbox/config"
import { remoteGradings } from "@/server/remoteSandbox/remoteGradings"

validateGradingConfig()
if (gradingSandboxMode() === "remote") {
  remoteGradings().startSweeping()
}

export default createServerEntry({ fetch: (request) => handler.fetch(request) })
