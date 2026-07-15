import { exec as execOriginal } from "child_process"
import { readdir, stat } from "fs/promises"
import path from "path"
import { promisify } from "util"

import watcher from "@parcel/watcher"
import { groupBy } from "lodash"

const exec = promisify(execOriginal)

const ALL_SERVICES_TARGETS = [
  "services/cms/src/shared-module",
  "services/example-exercise/src/shared-module",
  "services/headless-lms/shared-module",
  "services/main-frontend/src/shared-module",
  "services/quizzes/src/shared-module",
  "services/tmc/src/shared-module",
  "system-tests/src/shared-module",
  "storybook/src/shared-module",
]

// The exercise-service packages are layered. Every service gets the zero-dependency protocol
// contract; only the React-based exercise/host services additionally vendor the client engines and
// the React adapter (exercise-react transitively imports exercise-client + exercise-protocol).
// system-tests, headless-lms and storybook import only the protocol contract, so they no longer
// vendor the React/emotion tree.
const REACT_EXERCISE_TARGETS = [
  "services/cms/src/shared-module",
  "services/example-exercise/src/shared-module",
  "services/main-frontend/src/shared-module",
  "services/quizzes/src/shared-module",
  "services/tmc/src/shared-module",
]

// The host SDK (MessageChannelIFrame) is used only by the apps that *embed* exercise iframes, not
// by the exercise services themselves (which are the iframe child). Only cms and main-frontend
// render it, so it is vendored there and nowhere else.
const HOST_TARGETS = ["services/cms/src/shared-module", "services/main-frontend/src/shared-module"]

// The exercise-service testing utilities (host emulator + Playwright helpers) are only needed by
// the standalone-capable template's e2e suite, which every generated service inherits. Vendoring it
// into example-exercise lets its `@/shared-module/exercise-service-test-utils/...` imports resolve;
// no other service uses it.
const TEST_UTIL_TARGETS = ["services/example-exercise/src/shared-module"]

// example-exercise is the standalone-capable template: it consumes only the exercise-service
// packages, so common and components are not synced into it.
const COMMON_AND_COMPONENTS_TARGETS = ALL_SERVICES_TARGETS.filter(
  (target) => target !== "services/example-exercise/src/shared-module",
)

const SYNC_TARGETS = [
  {
    source: "common",
    destinations: COMMON_AND_COMPONENTS_TARGETS,
  },
  {
    source: "components",
    destinations: COMMON_AND_COMPONENTS_TARGETS,
  },
  {
    source: "exercise-protocol",
    destinations: ALL_SERVICES_TARGETS,
  },
  {
    source: "exercise-client",
    destinations: REACT_EXERCISE_TARGETS,
  },
  {
    source: "exercise-react",
    destinations: REACT_EXERCISE_TARGETS,
  },
  {
    source: "exercise-iframe-host",
    destinations: HOST_TARGETS,
  },
  {
    source: "exercise-service-test-utils",
    destinations: TEST_UTIL_TARGETS,
  },
]

const DEBUG = false

interface ChangeDescription {
  path: string
  syncFolder: string | null
  operation: watcher.EventType
}
let subscriptions: watcher.AsyncSubscription[] = []
let shouldRestart = false

async function main() {
  await cleanUpFolders()

  const firstCmdArg = process.argv[2]
  if (firstCmdArg === "--once") {
    await syncEverything()
    return
  }

  let restarted = false

  process.once("SIGINT", async function (_signal) {
    console.log("Exitting...")
    await Promise.all(subscriptions.map((subscription) => subscription.unsubscribe()))
    process.exit(0)
  })

  process.on("unhandledRejection", (reason, _promise) => {
    console.error("Unhandled promise rejection detected, restarting...")
    console.error(reason)
    shouldRestart = true
  })

  // Loop to make sure restarts work

  while (true) {
    try {
      await runSync(restarted)
    } catch (error) {
      console.error("Error in runSync, restarting...")
      console.error(error)
    }
    restarted = true
  }
}

async function runSync(restarted: boolean) {
  const startTime = Date.now()
  shouldRestart = false
  console.clear()
  if (restarted) {
    console.log(
      "Restarted syncing at " +
        new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .replace("T", " ")
          .replace("Z", "")
          .split(".")[0],
    )
  }
  await syncEverything()

  // Subscribe to events, one subscription per sync target
  subscriptions = await Promise.all(
    SYNC_TARGETS.map(async (target) => {
      return await watcher.subscribe(
        path.resolve(__dirname, "packages", target.source, "src"),
        async (err, events) => {
          if (err) {
            console.error(`Error occurred while watching:`)
            console.error(err)
            shouldRestart = true
            return
          }
          try {
            const changes = groupBy(
              events.map((event) => {
                const relativePath = path.relative(__dirname, event.path)
                const syncFolder =
                  SYNC_TARGETS.find((syncTarget) =>
                    relativePath.startsWith(`packages` + path.sep + syncTarget.source),
                  ) ?? null
                return {
                  path: relativePath,
                  syncFolder: syncFolder?.source ?? null,
                  operation: event.type,
                } satisfies ChangeDescription
              }),
              (event) => event.syncFolder,
            )
            if (DEBUG) {
              console.log("Changes:", JSON.stringify(changes, null, 2))
            }

            for (const [syncFolder, folderEvents] of Object.entries(changes)) {
              const targets = SYNC_TARGETS.find((syncTarget) => syncTarget.source === syncFolder)

              // Syncing is done with rsync, but we'll want to minimize the number of files rsync has to go through
              // Therefore we'll find the common root of all changed files and sync from there
              const commonRoot = getCommonRootOfChanges(folderEvents)
              console.info(
                `Syncing changes in "${commonRoot}" to ${targets?.destinations.length} destinations.`,
              )
              for (const destination of targets?.destinations ?? []) {
                await syncPath(commonRoot, destination)
              }
            }
          } catch (error) {
            console.error("Error occurred while syncing changes:")
            console.error(error)
            shouldRestart = true
          }
        },
      )
    }),
  )

  console.log("Watching...")

  while (true) {
    await new Promise((resolve) => {
      setTimeout(resolve, 300_000)
    })
    if (shouldRestart) {
      console.log("Error detected, restarting in 15 seconds...")
      await new Promise((resolve) => {
        setTimeout(resolve, 15_000)
      })
      break
    }
    if (Date.now() - startTime > 3_600_000) {
      // Restarting the watching process to make sure nothing is missed in case of something like https://github.com/parcel-bundler/watcher/issues/97
      console.log("One hour has elapsed, restarting...")
      break
    }
  }
  await Promise.all(subscriptions.map((subscription) => subscription.unsubscribe()))
  subscriptions = []
}

function getCommonRootOfChanges(changes: ChangeDescription[]) {
  if (changes.length === 0) {
    throw new Error("Cannot get common root of empty list of changes")
  }
  const startingPoints = changes
    .map((event) => {
      if (event.operation === "delete") {
        // Since the source file no longer exists, we'll sync from the parent directory
        return path.dirname(event.path)
      }
      return event.path
    })
    .map((pathString) => pathString.split(path.sep))

  let commonRoot = ""
  const firstPathParts = startingPoints[0]
  for (let i = 0; i < firstPathParts.length; i++) {
    const currentPart = firstPathParts[i]
    if (
      currentPart !== undefined &&
      startingPoints.every((pathParts) => pathParts[i] === currentPart)
    ) {
      if (commonRoot !== "") {
        commonRoot += path.sep
      }
      commonRoot += currentPart
    } else {
      break
    }
  }
  if (commonRoot === "") {
    throw new Error("Could not find common root of changes")
  }
  return commonRoot
}

async function syncEverything() {
  for (const target of SYNC_TARGETS) {
    console.log(
      `Syncing packages${path.sep}${target.source}${path.sep}src to ${target.destinations.length} destinations.`,
    )
    for (const destination of target.destinations) {
      const fullPathToDestination = path.resolve(__dirname, "..", destination, target.source)
      await exec(`mkdir -p '${fullPathToDestination}'`)

      await syncPath(`packages${path.sep}${target.source}${path.sep}src`, destination)
    }
  }
}

async function syncPath(relativeSource: string, pathToTargetSharedModule: string) {
  let source = path.resolve(__dirname, relativeSource)
  try {
    // check if source is a directory
    const sourceStat = await stat(source)
    if (sourceStat.isDirectory()) {
      source = source + path.sep
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      // Source doesn't exist, skip syncing
      if (DEBUG) {
        console.log(`Source path does not exist, skipping: ${source}`)
      }
      return
    }
    throw error
  }
  const target = path.resolve(
    __dirname,
    "..",
    pathToTargetSharedModule,
    relativeSource.replace(`packages${path.sep}`, "").replace(`${path.sep}src`, ""),
  )

  const command = `rsync -a --checksum --delete --link-dest='${source}' '${source}' '${target}'`
  if (DEBUG) {
    console.log(`> ${command}`)
  }
  await exec(command)
}

async function cleanUpFolders() {
  for (const target of ALL_SERVICES_TARGETS) {
    const fullPathToDestination = path.resolve(__dirname, "..", target)
    try {
      // list files and folders in the destination
      const files = await readdir(fullPathToDestination)
      // Only the sources actually synced to THIS destination are allowed; with per-source
      // destinations a protocol-only target (e.g. system-tests) must treat the React packages as
      // stray and wipe them. Any other leftover (e.g. a package left behind after a rename) is
      // also cleaned up.
      const allowedFiles = SYNC_TARGETS.filter((syncTarget) =>
        syncTarget.destinations.includes(target),
      ).map((syncTarget) => syncTarget.source)
      const hasNotAllowedFiles = files.some((file) => !allowedFiles.includes(file))
      if (hasNotAllowedFiles) {
        console.info(`Cleaning up folders in ${target}...`)
        try {
          await exec(`rm -r '${fullPathToDestination}'`)
        } catch (e) {
          console.warn(`Could not remove ${fullPathToDestination}`, e)
        }
      }
    } catch (_e) {
      // NOP
    }
    await exec(`mkdir -p '${fullPathToDestination}'`)
  }
}

// oxlint-disable-next-line unicorn/prefer-top-level-await -- fire-and-forget entrypoint; avoid top-level await
main()
