/* eslint-disable @typescript-eslint/no-var-requires */
const generateNormalResponseHeaders =
  require("./src/shared-module/utils/responseHeaders").generateNormalResponseHeaders

// Forces one to sanitize HTML before using dangerouslySetInnerHTML
const normalResponseHeaders = generateNormalResponseHeaders({ requireTrustedTypesFor: true })

const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    outputStandalone: true,
  },
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
