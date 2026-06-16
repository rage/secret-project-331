import { resolve } from "node:path"

import { scaffoldReactProject } from "../src/index.ts"

/**
 * Non-interactive wrapper around {@link scaffoldReactProject}. Used by the CI smoke test (and
 * handy for manual end-to-end testing) to scaffold a project without going through the prompts.
 *
 * Usage: tsx scripts/scaffold-to.ts <path> <projectName> <port>
 */
async function main() {
  const [path, projectName, portArg] = process.argv.slice(2)
  if (!path || !projectName) {
    console.error("Usage: tsx scripts/scaffold-to.ts <path> <projectName> [port]")
    process.exitCode = 1
    return
  }
  const port = portArg ? Number(portArg) : 3002
  await scaffoldReactProject({
    projectName,
    absoluteProjectPath: resolve(path),
    port,
  })
}

main()
