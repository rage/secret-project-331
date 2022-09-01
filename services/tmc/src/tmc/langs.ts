/* eslint-disable i18next/no-literal-string */

import * as cp from "child_process"
import kill from "tree-kill"

import { Compression } from "./generated"

const execute = async (cmd: string, args: Array<string>): Promise<unknown> => {
  const cliPath = "/app/tmc-langs-cli"
  const executableArgs = [cmd, ...args]

  const cprocess = cp.spawn(cliPath, executableArgs, {
    env: {
      ...process.env,
      RUST_LOG: "debug",
    },
  })

  return new Promise<unknown>((resolve, reject) => {
    let stdoutBuffer = ""

    const timeout = setTimeout(() => {
      kill(cprocess.pid as number)
      reject("Process didn't seem to finish or was taking a really long time.")
    }, 20 * 60 * 1000)

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
    cprocess.stdout.on("data", (chunk) => {
      // received data from stdout
      stdoutBuffer += chunk.toString()
      // wait until we have a full line
      if (!stdoutBuffer.includes("\n")) {
        return
      }

      const lines = stdoutBuffer.split("\n")
      const line = lines[0]
      try {
        const json = JSON.parse(line)

        switch (json["output-kind"]) {
          case "output-data":
            resolve(json)
            break
          case "status-update":
            console.log(json)
            break
          case "warnings":
            break
          default:
            console.error("TMC-langs response didn't match expected type")
            console.debug(json)
        }
      } catch (e) {
        console.warn("Failed to parse TMC-langs output")
        console.debug(line)
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
  compression: Compression = "zstd",
  naive = false,
) => {
  await execute("extract-project", [
    "--archive-path",
    archivePath,
    "--output-path",
    outputPath,
    "--compression",
    compression,
    ...(naive ? ["--naive"] : []),
  ])
}

export const compressProject = async (
  exercisePath: string,
  outputPath: string,
  compression: Compression = "zstd",
  naive = false,
) => {
  await execute("compress-project", [
    "--exercise-path",
    exercisePath,
    "--output-path",
    outputPath,
    "--compression",
    compression,
    ...(naive ? ["--naive"] : []),
  ])
}

export const prepareSolution = async (exercisePath: string, outputPath: string) => {
  await execute("prepare-solution", ["--exercise-path", exercisePath, "--output-path", outputPath])
}

export const prepareStub = async (exercisePath: string, outputPath: string) => {
  await execute("prepare-stub", ["--exercise-path", exercisePath, "--output-path", outputPath])
}

export const prepareSubmission = async (
  clonePath: string,
  outputPath: string,
  submissionPath: string,
) => {
  await execute("prepare-submission", [
    "--clone-path",
    clonePath,
    "--output-path",
    outputPath,
    "--submission-path",
    submissionPath,
  ])
}
