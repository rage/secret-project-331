/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-var-requires */
const externallyEmbeddableIFrameResponseHeaders =
  require("./src/shared-module/utils/responseHeaders").externallyEmbeddableIFrameResponseHeaders

const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: externallyEmbeddableIFrameResponseHeaders,
      },
      // This application is meant to be used with a sandboxed iframe.
      // That causes that we need cors headers for fonts.
      {
        source: "/(.*).woff2",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ]
  },
  output: "standalone",
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
