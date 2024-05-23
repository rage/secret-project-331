// eslint-disable-next-line @typescript-eslint/no-var-requires
const configTemplate = require("@/shared-module/common/utils/i18next-parser.config.template")

const config = {
  ...configTemplate,
  // eslint-disable-next-line i18next/no-literal-string
  defaultNamespace: "main-frontend",
}

module.exports = config
