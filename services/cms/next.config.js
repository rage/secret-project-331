/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-var-requires */
const generateNormalResponseHeaders =
  require("./src/shared-module/utils/responseHeaders").generateNormalResponseHeaders

const normalResponseHeaders = generateNormalResponseHeaders()

const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: normalResponseHeaders,
      },
    ]
  },
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
