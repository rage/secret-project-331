import * as k8s from "@kubernetes/client-node"
import { createReadStream, createWriteStream, promises as fs } from "fs"
import path from "path"
import internal from "stream"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"

import { downloadStream, initKubeApi, initKubeConfig } from "@/lib"
import { RunResult } from "@/tmc/cli"
import { isRunResult } from "@/tmc/cli.guard"
import { compressProject, extractProject, prepareSubmission } from "@/tmc/langs"

const DEFAULT_TASK_TIMEOUT_MS = 60000

export type Submission =
  | {
      type: "browser"
      files: Array<{ filepath: string; contents: string }>
    }
  | {
      type: "editor"
      archiveDownloadUrl: string
    }

// runs tests in a sandbox pod
export const runTests = async (
  templateDownloadUrl: string,
  submission: Submission,
): Promise<RunResult> => {
  debug("prepare submission for the grading pod")
  const submissionArchivePath = temporaryFile()
  if (submission.type === "editor") {
    debug("testing editor submission")
    await downloadStream(submission.archiveDownloadUrl, submissionArchivePath)
    // todo: support other compression methods? for now we just assume .tar.zstd
  } else if (submission.type === "browser") {
    debug("testing  browser submission")
    const submissionDir = temporaryDirectory()
    for (const { filepath, contents } of submission.files) {
      const resolved = path.resolve(submissionDir, filepath)
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      await fs.writeFile(resolved, contents)
    }
    debug("compressing project")
    await compressProject(submissionDir, submissionArchivePath, "zstd", true, log)
  } else {
    throw "Unreachable"
  }

  debug("downloading exercise template")
  const templateArchivePath = temporaryFile()
  await downloadStream(templateDownloadUrl, templateArchivePath)

  debug("extracting template")
  const extractedTemplatePath = temporaryDirectory()
  await extractProject(templateArchivePath, extractedTemplatePath, log)
  log("template")
  // prepare submission with tmc-langs
  const preparedSubmissionArchivePath = temporaryFile()
  const sandboxImage = await prepareSubmission(
    extractedTemplatePath,
    preparedSubmissionArchivePath,
    submissionArchivePath,
    "zstd",
    false,
    log,
  )

  const testPath = temporaryFile()
  await extractProject(preparedSubmissionArchivePath, testPath, log)

  const testPatha = temporaryFile()
  await extractProject(submissionArchivePath, testPatha, log)

  log("preparing pod")
  const kubeConfig = initKubeConfig()
  const kubeApi = initKubeApi()

  const pod = new k8s.V1Pod()

  // set pod.metadata
  const podId = v4()
  const podName = `tmc-sandbox-pod-${podId}`
  pod.metadata = new k8s.V1ObjectMeta()
  pod.metadata.name = podName

  // set pod.spec
  const container = new k8s.V1Container()
  const containerName = "tmc-submission-execution-sandbox"
  container.name = containerName
  container.image = sandboxImage
  // the container sleeps for the task timeout + 10 minutes to
  // ensure the container doesn't stay up for too long if something goes wrong
  container.command = ["sleep", (DEFAULT_TASK_TIMEOUT_MS + 10 * 60 * 1000).toString()]

  let runResult: RunResult
  try {
    log(`testing in pod ${podName}`)
    runResult = await runTestsInner(
      kubeApi,
      kubeConfig,
      pod,
      podName,
      container,
      containerName,
      sandboxImage,
      preparedSubmissionArchivePath,
    )
  } catch (e) {
    console.error(`Failed to test in pod: ${e}`)
    // todo logs
    runResult = {
      status: "GENERIC_ERROR",
      testResults: [],
      logs: {},
    }
  }

  // delete the pod now that we're done
  log(`deleting pod ${podName}`)
  try {
    await kubeApi.deleteNamespacedPod({ name: podName, namespace: "default", pretty: "true" })
  } catch (_e) {
    error("failed to delete pod")
  }

  return runResult
}

const runTestsInner = async (
  kubeApi: k8s.CoreV1Api,
  kubeConfig: k8s.KubeConfig,
  pod: k8s.V1Pod,
  podName: string,
  container: k8s.V1Container,
  containerName: string,
  sandboxImage: string,
  submissionPath: string,
): Promise<RunResult> => {
  pod.spec = new k8s.V1PodSpec()
  pod.spec.containers = [container]

  // start pod and wait for it to start
  log("starting sandbox image", sandboxImage)
  await kubeApi.createNamespacedPod({ namespace: "default", body: pod, pretty: "true" })
  let podPhase = null
  while (podPhase !== "Running") {
    // poll once per 500 ms
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    await delay(500)

    const podStatus = await kubeApi.readNamespacedPodStatus({
      namespace: "default",
      name: podName,
      pretty: "true",
    })
    podPhase = podStatus.status?.phase
    if (podPhase !== "Pending" && podPhase !== "Running") {
      // may indicate a problem like the pod crashing
      throw new Error(`Unexpected phase ${podPhase}`)
    }
  }

  // copy and extract exercise to pod /app/
  const kubeExec = new k8s.Exec(kubeConfig)
  const submissionReadStream = createReadStream(submissionPath)
  const tarResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    [
      "tar",
      "--verbose",
      "--use-compress-program",
      "zstd",
      "--extract",
      "--file",
      "-",
      "--directory",
      "/app/",
    ],
    process.stdout,
    process.stderr,
    submissionReadStream,
    DEFAULT_TASK_TIMEOUT_MS, // could use a different/shorter timeout here
  )
  if (tarResult.timedOut) {
    throw new Error("Running tar inside the container timed out")
  }

  // run tests, the image should have a /tmc-run script
  const tmcRunResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    ["/tmc-run"],
    process.stdout,
    process.stderr,
    null,
    DEFAULT_TASK_TIMEOUT_MS,
  )
  if (tmcRunResult.timedOut) {
    log("tmc-run timed out")
    // todo logs
    return {
      status: "GENERIC_ERROR",
      testResults: [],
      logs: {},
    }
  } else {
    log("tmc-run finished")
  }

  // read test results, the container should now have an /app/test_output.txt file
  /*
  cpFromPod is broken: https://github.com/kubernetes-client/javascript/issues/982
  while waiting for a fix, we do the copy via `cat`
  const kubeCp = new k8s.Cp(kubeConfig)
  const f = await kubeCp.cpFromPod(
    "default",
    podName,
    containerName,
    "/app/test_output.txt",
    testOutputPath,
  )
  */
  const testOutputPath = temporaryFile()
  const testOutputWriteStream = createWriteStream(testOutputPath)
  const catResult = await execWithTimeout(
    kubeExec,
    podName,
    containerName,
    ["cat", "/app/test_output.txt"],
    testOutputWriteStream,
    process.stderr,
    null,
    DEFAULT_TASK_TIMEOUT_MS, // could use a different/shorter timeout here
  )
  if (catResult.timedOut) {
    throw new Error("Running cat inside the container timed out")
  }
  const testOutputBuffer = await fs.readFile(testOutputPath)
  const testOutputString = testOutputBuffer.toString()
  log(`got output ${testOutputString} end`)
  const testOutput = JSON.parse(testOutputString)

  if (isRunResult(testOutput)) {
    return testOutput
  } else {
    throw new Error("Unexpected results")
  }
}

// convenience function for executing stuff inside a container
const execWithTimeout = async (
  kubeExec: k8s.Exec,
  podName: string,
  containerName: string,
  command: Array<string>,
  stdout: internal.Writable,
  stderr: internal.Writable,
  stdin: internal.Readable | null,
  timeoutMs: number,
): Promise<{ timedOut: boolean }> => {
  const execSocket = await kubeExec.exec(
    "default",
    podName,
    containerName,
    command,
    stdout,
    stderr,
    stdin,
    false,
  )
  const execPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    execSocket.onclose = () => resolve({ timedOut: false })
  })
  const timeoutPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    setTimeout(() => {
      resolve({ timedOut: true })
    }, timeoutMs)
  })
  return await Promise.race([execPromise, timeoutPromise])
}

// logging helpers

const log = (message: string, ...optionalParams: unknown[]): void => {
  console.log(`[test]`, message, ...optionalParams)
}

const debug = (message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[test]`, message, ...optionalParams)
}

const error = (message: string, ...optionalParams: unknown[]): void => {
  console.error(`[test]`, message, ...optionalParams)
}
