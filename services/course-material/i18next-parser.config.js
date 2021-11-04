// eslint-disable-next-line @typescript-eslint/no-var-requires
const configTemplate = require("./src/shared-module/utils/i18next-parser.config.template")

const config = {
  ...configTemplate,
  // eslint-disable-next-line i18next/no-literal-string
  defaultNamespace: "course-material",
}

module.exports = config
