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

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (...props) => {
    const dynamicModule = jest.requireActual("next/dynamic")
    const dynamicActualComp = dynamicModule.default
    const RequiredComponent = dynamicActualComp(props[0])

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    RequiredComponent.preload ? RequiredComponent.preload() : RequiredComponent.render.preload()
    return RequiredComponent
  },
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Translation: ({ children }) => children((key) => key),
}))

const originalClipboard = navigator.clipboard
afterEach(() => {
  jest.resetAllMocks()
  // Restore navigator.clipboard if it was modified during tests
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  })
})
