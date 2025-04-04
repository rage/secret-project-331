import watcher from "@parcel/watcher"
import { exec as execOriginal } from "child_process"
import { readdir, stat } from "fs/promises"
import { groupBy } from "lodash"
import path from "path"
import { promisify } from "util"

const exec = promisify(execOriginal)

const ALL_SERVICES_TARGETS = [
  "services/cms/src/shared-module",
  "services/course-material/src/shared-module",
  "services/example-exercise/src/shared-module",
  "services/headless-lms/shared-module",
  "services/main-frontend/src/shared-module",
  "services/quizzes/src/shared-module",
  "services/tmc/src/shared-module",
  "system-tests/src/shared-module",
  "storybook/src/shared-module",
]

const SYNC_TARGETS = [
  {
    source: "common",
    destinations: ALL_SERVICES_TARGETS,
  },
]

const DEBUG = false

interface ChangeDescription {
  path: string
  syncFolder: string | null
  operation: watcher.EventType
}
let subscriptions: watcher.AsyncSubscription[] = []

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

  // Loop to make sure restarts work

  while (true) {
    await runSync(restarted)
    restarted = true
  }
}

async function runSync(restarted: boolean) {
  const startTime = Date.now()
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
          }
          const changes = groupBy(
            events.map((event) => {
              const relativePath = path.relative(__dirname, event.path)
              const syncFolder =
                SYNC_TARGETS.find((target) =>
                  relativePath.startsWith(`packages` + path.sep + target.source),
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

          for (const [syncFolder, events] of Object.entries(changes)) {
            const targets = SYNC_TARGETS.find((target) => target.source === syncFolder)

            // Syncing is done with rsync, but we'll want to minimize the number of files rsync has to go through
            // Therefore we'll find the common root of all changed files and sync from there
            const commonRoot = getCommonRootOfChanges(events)
            console.info(
              `Syncing changes in "${commonRoot}" to ${targets?.destinations.length} destinations.`,
            )
            for (const destination of targets?.destinations ?? []) {
              await syncPath(commonRoot, destination)
            }
          }
        },
      )
    }),
  )

  console.log("Watching...")

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 300_000))
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
  // check if source is a directory
  const sourceStat = await stat(source)
  if (sourceStat.isDirectory()) {
    source = source + path.sep
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
      const allowedFiles = SYNC_TARGETS.map((target) => target.source)
      const hasNotAllowedFiles = files.some((file) => !allowedFiles.includes(file))
      if (!hasNotAllowedFiles) {
        return
      }
      console.info("Cleaning up folders...")
      try {
        await exec(`rm -r '${fullPathToDestination}'`)
      } catch (e) {
        console.warn(`Could not remove ${fullPathToDestination}`, e)
      }
    } catch (_e) {
      // NOP
    }
    await exec(`mkdir -p '${fullPathToDestination}'`)
  }
}

main()
