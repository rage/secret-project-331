import { ServerResponse } from "http"
import { TextEncoder } from "util"

global.TextEncoder = TextEncoder
global.Response = ServerResponse
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = input
    this.method = init.method || "GET"
    this.headers = new Headers(init.headers)
  }
}

global.TransformStream = class TransformStream {
  constructor() {
    this.readable = {}
    this.writable = {}
  }
}

global.BroadcastChannel = class BroadcastChannel {
  constructor(channel) {
    this.channel = channel
  }
  postMessage(_message) {
    // NOP
  }
  addEventListener(_type, _listener) {
    // NOP
  }
  removeEventListener(_type, _listener) {
    // NOP
  }
  close() {
    // NOP
  }
}
