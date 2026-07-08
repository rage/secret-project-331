/* eslint-disable @typescript-eslint/no-unused-expressions */
// Injectable browser host emulator — the parent/host side of the exercise iframe protocol, written
// as a single self-contained arrow-function expression so it can be injected verbatim:
//
//   playwright-cli open http://localhost:<port>/iframe        # open the iframe page FIRST
//   playwright-cli eval "$(cat hostEmulator.js)"              # installs window.__host + hands over the port
//   playwright-cli eval "() => window.__host.setState('answer-exercise', { public_spec: [], previous_submission: null })"
//   playwright-cli eval "() => window.__host.last('current-state')"
//
// Works because on the iframe's own top-level page window === window.parent, so this
// window.postMessage(port) satisfies the child's `source === parent` check.
//
// This is kept byte-identical to the HOST_EMULATOR_SOURCE string in ./hostEmulatorSource.ts
// (guarded by tests/sourceParity.test.ts). Do NOT add imports — it must eval standalone.
(options) => {
  const opts = options || {}
  const autoUpload = opts.autoUpload !== false
  const autoDialog = opts.autoDialog !== false
  const uploadUrlBase = opts.uploadUrlBase || "https://uploads.example/"
  const createChannel = opts.createChannel || (() => new MessageChannel())
  const transferPort =
    opts.transferPort || ((p) => window.postMessage("communication-port", "*", [p]))

  const history = []
  const waiters = []
  let channel = null
  let port = null
  let portSent = false

  const record = (msg) => {
    history.push(msg)
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].match(msg)) {
        const waiter = waiters[i]
        waiters.splice(i, 1)
        clearTimeout(waiter.timer)
        waiter.resolve(msg)
      }
    }
  }

  const post = (msg) => port.postMessage(msg)

  const handleMessage = (event) => {
    const msg = event && event.data
    if (!msg || typeof msg !== "object") {
      return
    }
    record(msg)
    if (msg.message === "file-upload" && autoUpload) {
      const urls = new Map()
      msg.files.forEach((value, name) => {
        urls.set(name, uploadUrlBase + encodeURIComponent(name))
      })
      post({ message: "upload-result", requestId: msg.requestId ?? null, success: true, urls })
    } else if (msg.message === "open-dialog" && autoDialog) {
      post({ message: "dialog-response", requestId: msg.requestId, confirmed: true })
    }
  }

  const setupChannel = () => {
    channel = createChannel()
    port = channel.port1
    port.onmessage = handleMessage
  }

  const transfer = () => {
    portSent = true
    transferPort(channel.port2)
  }

  setupChannel()

  // Hand the child a port when it announces it is ready. The child posts "ready" on mount and keeps
  // retrying until it gets one, so a single listener catches it regardless of injection timing. Use
  // one channel and transfer once: anything posted before the child attaches (e.g. an eager
  // set-state) is buffered by the MessagePort and delivered on connect.
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("message", (event) => {
      if (event && event.data === "ready" && !portSent) {
        transfer()
      }
    })
  }

  const findLast = (type) => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].message === type) {
        return history[i]
      }
    }
    return null
  }

  const api = {
    setState(viewType, data, overrides) {
      const base = {
        message: "set-state",
        view_type: viewType,
        exercise_task_id: "00000000-0000-0000-0000-000000000000",
        user_information: { pseudonymous_id: "test-user", signed_in: false },
        user_variables: {},
        data,
      }
      post(Object.assign(base, overrides || {}))
    },
    setStateRaw(state) {
      post(Object.assign({ message: "set-state" }, state))
    },
    setLanguage(language) {
      post({ message: "set-language", data: language })
    },
    sendUploadResult(requestId, result) {
      const r = result || {}
      if (r.error !== undefined && r.error !== null) {
        post({ message: "upload-result", requestId: requestId ?? null, success: false, error: r.error })
        return
      }
      const urls = r.urls instanceof Map ? r.urls : new Map(Object.entries(r.urls || {}))
      post({ message: "upload-result", requestId: requestId ?? null, success: true, urls })
    },
    respondToDialog(requestId, confirmed) {
      post({ message: "dialog-response", requestId, confirmed: confirmed !== false })
    },
    sendRepositoryExercises(repositoryExercises) {
      post({ message: "repository-exercises", repository_exercises: repositoryExercises || [] })
    },
    sendTestResults(testResult) {
      post({ message: "test-results", test_result: testResult })
    },
    last(type) {
      return findLast(type)
    },
    messages(type) {
      return type ? history.filter((m) => m.message === type) : history.slice()
    },
    waitFor(type, predicate, timeoutMs) {
      const match = (m) => m.message === type && (!predicate || predicate(m))
      const existing = history.find(match)
      if (existing) {
        return Promise.resolve(existing)
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          match,
          resolve,
          timer: setTimeout(() => {
            const idx = waiters.indexOf(waiter)
            if (idx >= 0) {
              waiters.splice(idx, 1)
            }
            reject(new Error("Timed out waiting for message: " + type))
          }, timeoutMs || 5000),
        }
        waiters.push(waiter)
      })
    },
    reset() {
      history.length = 0
    },
  }

  window.__host = api
  return "host emulator ready"
}
