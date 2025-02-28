import { TextEncoder } from "util"
global.TextEncoder = TextEncoder

class MessageChannel {
  constructor() {
    this.port1 = {
      postMessage: () => {},
    }
    this.port2 = {
      postMessage: () => {},
    }
  }
}
global.MessageChannel = MessageChannel
