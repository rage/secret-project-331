/* eslint-disable i18next/no-literal-string */
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      // This application is meant to be used with a sandboxed iframe.
      // That causes that we need cors headers for fonts.
      {
        source: "/(.*).woff2",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ]
  },
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
