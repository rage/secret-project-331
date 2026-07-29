// jsdom's Blob/File implementation does not provide arrayBuffer()/text(), which real browsers have.
// Polyfill them via FileReader so tests can read file bytes the way production code does. Guarded so
// this becomes a no-op if the test environment ever ships them natively.
if (typeof Blob !== "undefined") {
  const readWith = (method) =>
    function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader[method](this)
      })
    }
  if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = readWith("readAsArrayBuffer")
  }
  if (typeof Blob.prototype.text !== "function") {
    Blob.prototype.text = readWith("readAsText")
  }
}

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (...props) => {
    const dynamicModule = jest.requireActual("next/dynamic")
    const dynamicActualComp = dynamicModule.default
    const RequiredComponent = dynamicActualComp(props[0])

    // oxlint-disable-next-line typescript/no-unused-expressions
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
