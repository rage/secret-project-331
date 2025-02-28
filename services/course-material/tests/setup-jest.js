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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Translation: ({ children }) => children((key) => key),
}))

jest.mock("next/dynamic", () => () => {
  const DynamicComponent = ({ content }) => <div>{content}</div>
  return DynamicComponent
})

const originalClipboard = navigator.clipboard
afterEach(() => {
  jest.resetAllMocks()
  // Restore navigator.clipboard if it was modified during tests
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  })
})
