/* eslint-disable import/order */
/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-var-requires */
const generateNormalResponseHeaders =
  require("./src/shared-module/utils/responseHeaders").generateNormalResponseHeaders

const normalResponseHeaders = generateNormalResponseHeaders()

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = withBundleAnalyzer(config)
