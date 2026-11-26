/**
 * Module worker that owns one Pyodide instance for both Run and Test. Pyodide 314+ refuses to load
 * in a classic worker.
 *
 * The page passes the Pyodide directory as `?indexURL=`, so the version lives only in the page's
 * build. Posts `ready` or `load_error` once, then answers `run` and `test` messages one at a time.
 */
const indexURL = new URL(self.location.href).searchParams.get("indexURL")

let pendingStdinResolve = null

/** Called from pythonRunner.py through the `js` module. */
self.requestStdinLine = (prompt) => {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "stdin_request", prompt })
  return new Promise((resolve) => {
    pendingStdinResolve = resolve
  })
}

async function load() {
  const runnerSourcePromise = fetch(new URL("pythonRunner.py", self.location.href)).then((r) => {
    if (!r.ok) {
      throw new Error(`Fetching pythonRunner.py failed: ${r.status}`)
    }
    return r.text()
  })
  const { loadPyodide } = await import(`${indexURL}pyodide.mjs`)
  const [pyodide, runnerSource] = await Promise.all([
    loadPyodide({ indexURL }),
    runnerSourcePromise,
  ])
  const runner = pyodide.toPy({})
  pyodide.runPython(runnerSource, { globals: runner })
  return { pyodide, runner }
}

// oxlint-disable-next-line unicorn/prefer-top-level-await -- run and test await this one load
const loaded = load()

function streamTo(type) {
  const decoder = new TextDecoder("utf-8", { fatal: false })
  return {
    raw: (byte) => {
      const chunk = decoder.decode(new Uint8Array([byte]), { stream: true })
      if (chunk.length > 0) {
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
        self.postMessage({ type, chunk })
      }
    },
  }
}

async function run({ source, filename }) {
  const { pyodide, runner } = await loaded
  pyodide.setStdout(streamTo("stdout"))
  pyodide.setStderr(streamTo("stderr"))
  runner.set("source", source)
  runner.set("filename", filename)
  const error = await pyodide.runPythonAsync("await run_main(source, filename)", {
    globals: runner,
  })
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage(error ? { type: "run_error", message: error } : { type: "run_done" })
}

async function test({ script }) {
  const { pyodide, runner } = await loaded
  pyodide.runPython("restore_input()", { globals: runner })
  pyodide.setStdin({ stdin: () => undefined })
  let stdout = ""
  const stderr = []
  pyodide.setStdout({ batched: (line) => (stdout += line + "\n") })
  pyodide.setStderr({ batched: (line) => stderr.push(line) })
  await pyodide.runPythonAsync(script, { globals: pyodide.toPy({}) })
  const lastLine = stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .at(-1)
  const runResult = JSON.parse(lastLine ?? "")
  if (stderr.length > 0) {
    runResult.stderr = stderr.join("\n")
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "test_result", runResult })
}

self.addEventListener("message", (event) => {
  const message = event.data
  if (message.type === "stdin_line") {
    pendingStdinResolve?.(String(message.line ?? ""))
    pendingStdinResolve = null
    return
  }
  const operation = message.type === "run" ? run : message.type === "test" ? test : null
  if (operation === null) {
    return
  }
  operation(message).catch((error) => {
    const text = String(error?.message ?? error)
    const failure =
      message.type === "run"
        ? { type: "run_error", message: text }
        : { type: "test_error", message: text }
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
    self.postMessage(failure)
  })
})

try {
  await loaded
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "ready" })
} catch (error) {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "load_error", message: String(error?.message ?? error) })
}
