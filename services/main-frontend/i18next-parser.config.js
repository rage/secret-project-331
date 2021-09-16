// eslint-disable-next-line @typescript-eslint/no-var-requires
const configTemplate = require("./src/shared-module/utils/i18next-parser.config.template")

const config = {
  ...configTemplate,
  defaultNamespace: "main-frontend",
}

module.exports = config
