// Host emulator for driving an exercise-service iframe in isolation — a local, scriptable stand-in
// for the real host / the Playground. It plays the parent side of the protocol: transfers a
// MessagePort to the iframe, lets you push `set-state`/`set-language`, auto-answers `file-upload`
// (with fake stored URLs) and `open-dialog` (confirm), and records the iframe's latest message of
// each type so `current-state` isn't lost among the frequent `height-changed` messages.
//
// It is a single arrow-function expression so it can be injected as-is:
//
//   playwright-cli open http://localhost:<port>/iframe        # open FIRST so the iframe mounts
//   playwright-cli eval "$(cat host-emulator.js)"             # installs window.__host + hands over the port
//   playwright-cli eval "() => window.__host.setState('answer-exercise', { public_spec: [...], previous_submission: null })"
//   playwright-cli eval "() => window.__host.last('current-state')"   # read what the iframe emitted
//
// Works because this page is top-level, so window === window.parent: a window.postMessage carries
// source === parent, which is what the iframe's connection handshake requires.
() => {
  const ch = new MessageChannel()
  const port = ch.port2
  const lastByType = {}
  port.onmessage = (e) => {
    const msg = e && e.data
    if (!msg || typeof msg !== "object") {
      return
    }
    lastByType[msg.message] = msg
    if (msg.message === "file-upload") {
      // Pretend to store the files and hand back URLs, echoing the correlation id (if any).
      const urls = new Map()
      msg.files.forEach((_value, name) =>
        urls.set(name, "https://uploads.example/" + encodeURIComponent(name)),
      )
      port.postMessage({
        message: "upload-result",
        requestId: msg.requestId ?? null,
        success: true,
        urls,
      })
    } else if (msg.message === "open-dialog") {
      port.postMessage({ message: "dialog-response", requestId: msg.requestId, confirmed: true })
    }
  }
  // Hand the iframe one end of the channel. The iframe already posted "ready" on mount and retries,
  // so transferring the port now is enough.
  window.postMessage("port", "*", [ch.port1])
  window.__host = {
    /** Push a set-state for `viewType` with the given view `data` payload. */
    setState(viewType, data) {
      port.postMessage({
        message: "set-state",
        view_type: viewType,
        exercise_task_id: "00000000-0000-0000-0000-000000000000",
        user_information: { pseudonymous_id: "demo", signed_in: false },
        user_variables: {},
        data,
      })
    },
    /** Tell the iframe the UI language (BCP 47). */
    setLanguage(language) {
      port.postMessage({ message: "set-language", data: language })
    },
    /** The iframe's most recent message of `type`, e.g. last("current-state"). */
    last(type) {
      return lastByType[type] ?? null
    },
  }
  return "host emulator ready"
}
