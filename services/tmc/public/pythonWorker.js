/**
 * Module worker that owns one Pyodide instance for both Run and Test. Pyodide 314+ refuses to load
 * in a classic worker.
 *
 * The page passes the Pyodide directory as `?indexURL=`, so the version lives only in the page's
 * build. Posts `ready` or `load_error` once, then answers `run` and `test` messages one at a time.
 *
 * `input()` blocks on stdinServiceWorker.js when it controls this worker: a `stdin_request` then
 * carries an `id`, and the page posts the line to the service worker. Otherwise the page posts it
 * here as `stdin_line`.
 */
const indexURL = new URL(self.location.href).searchParams.get("indexURL")
const STDIN_URL = new URL("__stdin", self.location.href)

let pendingStdinResolve = null

/** Called from pythonRunner.py through the `js` module; blocks until the page answers. */
self.readStdinLineSync = (prompt) => {
  const id = crypto.randomUUID()
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "stdin_request", prompt, id })
  const url = new URL(STDIN_URL)
  url.searchParams.set("id", id)
  for (;;) {
    const request = new XMLHttpRequest()
    request.open("GET", url, false)
    request.send()
    if (request.status === 200) {
      return request.responseText
    }
    if (request.status !== 204) {
      throw new Error(`Reading input failed: ${request.status}`)
    }
  }
}

/** Called from pythonRunner.py through the `js` module. */
self.requestStdinLine = (prompt) => {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage({ type: "stdin_request", prompt })
  return new Promise((resolve) => {
    pendingStdinResolve = resolve
  })
}

/**
 * Whether stdinServiceWorker.js intercepts this worker's requests. Probed with a synchronous XHR,
 * like the reads, because Firefox sends a worker's fetch() past the service worker.
 */
function hasStdinServiceWorker() {
  try {
    const probe = new URL(STDIN_URL)
    probe.searchParams.set("probe", "")
    const request = new XMLHttpRequest()
    request.open("GET", probe, false)
    request.send()
    return request.status === 200 && request.responseText === "ready"
  } catch {
    return false
  }
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

let hasServiceWorkerStdin = false

async function run({ source, filename }) {
  const { pyodide, runner } = await loaded
  // Probed per Run until it succeeds: Firefox lets the service worker see a worker's requests only
  // once the worker's script has finished evaluating.
  hasServiceWorkerStdin ||= hasStdinServiceWorker()
  // `undefined` lets run_main pick a mode; JS null would arrive as jsnull, not None.
  runner.set("input_mode", hasServiceWorkerStdin ? "service-worker" : undefined)
  pyodide.setStdout(streamTo("stdout"))
  pyodide.setStderr(streamTo("stderr"))
  runner.set("source", source)
  runner.set("filename", filename)
  const error = await pyodide.runPythonAsync("await run_main(source, filename, input_mode)", {
    globals: runner,
  })
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no targetOrigin
  self.postMessage(error ? { type: "run_error", message: error } : { type: "run_done" })
}

async function test({ script }) {
  const { pyodide, runner } = await loaded
  pyodide.runPython("reset_interpreter()", { globals: runner })
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
