/* oxlint-disable -- injectable eval payload kept byte-identical to HOST_EMULATOR_SOURCE (guarded by sourceParity.test.ts); the linter must not rewrite this dependency-free source */
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
  const fileUploadRecords = []
  const fileUploadWaiters = []
  let fileUploadGeneration = 0
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

  const sha256 = async (blob) => {
    const bytes = blob.arrayBuffer
      ? await blob.arrayBuffer()
      : await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(reader.error)
          reader.onload = () => resolve(reader.result)
          reader.readAsArrayBuffer(blob)
        })
    if (typeof crypto === "undefined" || !crypto.subtle) {
      throw new Error("Web Crypto SHA-256 is unavailable")
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  const snapshotEntry = async (key, value) => {
    const isFile = typeof File !== "undefined" && value instanceof File
    const isBlob = typeof Blob !== "undefined" && value instanceof Blob
    if (isFile || isBlob) {
      return {
        key: String(key),
        kind: isFile ? "file" : "blob",
        name: isFile ? value.name : null,
        type: value.type || null,
        size: value.size,
        lastModified: isFile ? value.lastModified : null,
        sha256: await sha256(value),
      }
    }
    if (typeof value === "string") {
      const bytes = new TextEncoder().encode(value)
      return {
        key: String(key),
        kind: "string",
        name: null,
        type: null,
        size: bytes.byteLength,
        lastModified: null,
        sha256: await sha256(new Blob([bytes])),
      }
    }
    return {
      key: String(key),
      kind: "unsupported",
      name: null,
      type: null,
      size: null,
      lastModified: null,
      sha256: null,
    }
  }

  const normalizeFileUploadEntries = (files) => {
    let filesKind = "other"
    let entries = []
    if (files === undefined) {
      filesKind = "missing"
    } else if (files instanceof Map) {
      filesKind = "map"
      entries = Array.from(files.entries())
    } else if (Array.isArray(files)) {
      filesKind = "array"
      entries = Array.from(files.entries())
    } else if (
      files !== null &&
      typeof files === "object" &&
      (Object.getPrototypeOf(files) === Object.prototype || Object.getPrototypeOf(files) === null)
    ) {
      filesKind = "plain-object"
      entries = Object.entries(files)
    }
    return { filesKind, entries }
  }

  const snapshotFileUpload = async (msg) => {
    const { filesKind, entries } = normalizeFileUploadEntries(msg.files)
    return {
      requestId: typeof msg.requestId === "string" ? msg.requestId : null,
      filesKind,
      entries: await Promise.all(entries.map(([key, value]) => snapshotEntry(key, value))),
    }
  }

  const completedFileUploads = () => {
    const snapshots = []
    for (const record of fileUploadRecords) {
      if (record.snapshot === null) {
        break
      }
      snapshots.push(record.snapshot)
    }
    return snapshots
  }

  const resolveFileUploadWaiters = () => {
    const completed = completedFileUploads()
    for (let i = fileUploadWaiters.length - 1; i >= 0; i--) {
      const match = completed.find(fileUploadWaiters[i].match)
      if (match) {
        const waiter = fileUploadWaiters[i]
        fileUploadWaiters.splice(i, 1)
        clearTimeout(waiter.timer)
        waiter.resolve(match)
      }
    }
  }

  const completeFileUpload = (generation, record, snapshot) => {
    if (generation !== fileUploadGeneration) {
      return
    }
    record.snapshot = snapshot
    resolveFileUploadWaiters()
  }

  const recordFileUpload = (msg) => {
    const generation = fileUploadGeneration
    const record = { snapshot: null }
    fileUploadRecords.push(record)
    snapshotFileUpload(msg)
      .then((snapshot) => completeFileUpload(generation, record, snapshot))
      .catch((error) => {
        console.error("Failed to snapshot file upload", error)
        if (generation !== fileUploadGeneration) {
          return
        }
        const index = fileUploadRecords.indexOf(record)
        if (index >= 0) {
          fileUploadRecords.splice(index, 1)
          resolveFileUploadWaiters()
        }
      }
      )
  }

  const createUploadId = () => {
    if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
      throw new Error("Web Crypto random values are unavailable")
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20)
  }

  const handleMessage = (event) => {
    const msg = event && event.data
    if (!msg || typeof msg !== "object") {
      return
    }
    record(msg)
    if (msg.message === "file-upload") {
      recordFileUpload(msg)
    }
    if (msg.message === "file-upload" && autoUpload) {
      const { entries } = normalizeFileUploadEntries(msg.files)
      const files = entries.map(([key, file]) => ({
        id: createUploadId(),
        url: uploadUrlBase + encodeURIComponent(
          file && typeof file.name === "string" ? file.name : String(key),
        ),
      }))
      post({ message: "upload-result", requestId: msg.requestId, success: true, files })
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
        post({ message: "upload-result", requestId, success: false, error: r.error })
        return
      }
      const files = Array.isArray(r.files) ? r.files : []
      post({ message: "upload-result", requestId, success: true, files })
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
    fileUploads() {
      return completedFileUploads()
    },
    fileUploadCount() {
      return fileUploadRecords.length
    },
    waitForFileUpload(predicate, timeoutMs) {
      const match = (upload) => !predicate || predicate(upload)
      const existing = completedFileUploads().find(match)
      if (existing) {
        return Promise.resolve(existing)
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          match,
          resolve,
          timer: setTimeout(() => {
            const idx = fileUploadWaiters.indexOf(waiter)
            if (idx >= 0) {
              fileUploadWaiters.splice(idx, 1)
            }
            reject(new Error("Timed out waiting for file-upload"))
          }, timeoutMs ?? 5000),
        }
        fileUploadWaiters.push(waiter)
      })
    },
    reset() {
      history.length = 0
      fileUploadRecords.length = 0
      fileUploadGeneration += 1
    },
  }

  window.__host = api
  return "host emulator ready"
}
