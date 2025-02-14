import { TextEncoder } from "util"
global.TextEncoder = TextEncoder

class MessageChannel {
  constructor() {
    this.port1 = {}
    this.port2 = {}
  }
}
global.MessageChannel = MessageChannel
