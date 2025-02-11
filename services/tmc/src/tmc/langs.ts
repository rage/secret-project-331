import * as cp from "child_process"
import * as readline from "readline"
import kill from "tree-kill"

import { Compression, ExercisePackagingConfiguration, OutputData } from "./cli"
import { isCliOutput } from "./cli.guard"

const execute = async (
  cmd: string,
  args: Array<string>,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<OutputData> => {
  const cliPath = "/app/tmc-langs-cli"
  const executableArgs = [cmd, ...args]
  log("executing", cliPath, executableArgs.join(" "))

  const cprocess = cp.spawn(cliPath, executableArgs, {
    env: {
      ...process.env,
      RUST_LOG: "debug,j4rs=error",
      RUST_BACKTRACE: "1",
    },
  })

  return new Promise<OutputData>((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        kill(cprocess.pid as number)
        reject("Process didn't seem to finish or was taking a really long time.")
      },
      20 * 60 * 1000,
    )

    // process events
    cprocess.on("error", (error) => {
      // something went wrong with the process, reject
      clearTimeout(timeout)
      reject(error)
    })
    cprocess.on("close", (_code) => {
      // the process has finished
      clearTimeout(timeout)
    })

    // stdout/err events
    const rl = readline.createInterface({ input: cprocess.stdout })
    rl.on("line", (input) => {
      // received data from stdout
      try {
        const json = JSON.parse(input)
        if (isCliOutput(json)) {
          if (json["output-kind"] === "output-data") {
            const data = json.data
            if (data?.["output-data-kind"] === "error") {
              console.error("Error:", json.message)
              console.error("Trace:", data["output-data"].trace.join("\n"))
              reject(json)
            } else {
              // not an error
              resolve(json)
            }
          }
          switch (json["output-kind"]) {
            case "output-data":
              break
            case "status-update":
              console.log(json)
              break
            case "notification":
              console.error(json)
              break
            default:
          }
        } else {
          console.error("TMC-langs response didn't match expected type")
          console.error(json)
        }
      } catch (_e) {
        console.warn("Failed to parse TMC-langs output")
        console.debug(input)
      }
    })
    cprocess.stderr.on("data", (chunk) => {
      // log errors
      console.error(chunk.toString())
    })
  })
}

export const extractProject = async (
  archivePath: string,
  outputPath: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
  compression: Compression = "zstd",
  naive = false,
) => {
  await execute(
    "extract-project",
    [
      "--archive-path",
      archivePath,
      "--output-path",
      outputPath,
      "--compression",
      compression,
      ...(naive ? ["--naive"] : []),
    ],
    log,
  )
}

export const compressProject = async (
  exercisePath: string,
  outputPath: string,
  compression: Compression = "zstd",
  naive = false,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<string> => {
  const output = await execute(
    "compress-project",
    [
      "--exercise-path",
      exercisePath,
      "--output-path",
      outputPath,
      "--compression",
      compression,
      ...(naive ? ["--naive"] : []),
    ],
    log,
  )
  if (output.data !== null && output.data["output-data-kind"] == "compressed-project-hash") {
    return output.data["output-data"]
  }
  throw new Error("Unexpected output data")
}

export const prepareSolution = async (
  exercisePath: string,
  outputPath: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
) => {
  await execute(
    "prepare-solution",
    ["--exercise-path", exercisePath, "--output-path", outputPath],
    log,
  )
}

export const prepareStub = async (
  exercisePath: string,
  outputPath: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
) => {
  await execute("prepare-stub", ["--exercise-path", exercisePath, "--output-path", outputPath], log)
}

export const prepareSubmission = async (
  clonePath: string,
  outputPath: string,
  submissionPath: string,
  submissionCompression: Compression = "zstd",
  naive = false,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<string> => {
  const output = await execute(
    "prepare-submission",
    [
      "--clone-path",
      clonePath,
      "--output-path",
      outputPath,
      "--output-format",
      "zstd",
      "--submission-path",
      submissionPath,
      "--submission-compression",
      submissionCompression,
      "--no-archive-prefix",
      ...(naive ? ["--extract-submission-naively"] : []),
    ],
    log,
  )
  if (output.data !== null && output.data["output-data-kind"] == "submission-sandbox") {
    return output.data["output-data"]
  }
  throw new Error("Unexpected output data")
}

export const getExercisePackagingConfiguration = async (
  exercisePath: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<ExercisePackagingConfiguration> => {
  const config = await execute(
    "get-exercise-packaging-configuration",
    ["--exercise-path", exercisePath],
    log,
  )
  if (config.data?.["output-data-kind"] === "exercise-packaging-configuration") {
    return config.data["output-data"]
  } else {
    throw new Error("Unexpected data")
  }
}

export const fastAvailablePoints = async (
  exercisePath: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<Array<string>> => {
  const config = await execute("fast-available-points", ["--exercise-path", exercisePath], log)
  if (config.data?.["output-data-kind"] === "available-points") {
    return config.data["output-data"]
  } else {
    throw new Error("Unexpected data")
  }
}
