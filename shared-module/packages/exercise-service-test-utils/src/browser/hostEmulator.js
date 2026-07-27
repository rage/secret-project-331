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

  const sha256WithoutWebCrypto = (buffer) => {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
      0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
      0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
      0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]
    const bytes = new Uint8Array(buffer)
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
    const padded = new Uint8Array(paddedLength)
    padded.set(bytes)
    padded[bytes.length] = 0x80
    const view = new DataView(padded.buffer)
    const bitLength = bytes.length * 8
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
    view.setUint32(paddedLength - 4, bitLength >>> 0)
    const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount))
    const words = new Uint32Array(64)
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i++) {
        words[i] = view.getUint32(offset + i * 4)
      }
      for (let i = 16; i < 64; i++) {
        const a = words[i - 15]
        const b = words[i - 2]
        const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3)
        const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10)
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0
      }
      let [a, b, c, d, e, f, g, h] = hash
      for (let i = 0; i < 64; i++) {
        const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
        const choice = (e & f) ^ (~e & g)
        const temp1 = (h + s1 + choice + constants[i] + words[i]) >>> 0
        const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
        const majority = (a & b) ^ (a & c) ^ (b & c)
        const temp2 = (s0 + majority) >>> 0
        h = g
        g = f
        f = e
        e = (d + temp1) >>> 0
        d = c
        c = b
        b = a
        a = (temp1 + temp2) >>> 0
      }
      const values = [a, b, c, d, e, f, g, h]
      for (let i = 0; i < hash.length; i++) {
        hash[i] = (hash[i] + values[i]) >>> 0
      }
    }
    return hash.map((value) => value.toString(16).padStart(8, "0")).join("")
  }

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
      return sha256WithoutWebCrypto(bytes)
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

  const snapshotFileUpload = async (msg) => {
    const files = msg.files
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

  const recordFileUpload = (msg) => {
    const generation = fileUploadGeneration
    const record = { snapshot: null }
    fileUploadRecords.push(record)
    snapshotFileUpload(msg).then((snapshot) => {
      if (generation !== fileUploadGeneration) {
        return
      }
      record.snapshot = snapshot
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
    })
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
      const files = msg.files.map((file) => ({
        id: crypto.randomUUID(),
        url: uploadUrlBase + encodeURIComponent(file.name),
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
