const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      // This applcation is meant to be used with a sandboxed iframe.
      // That causes that we need cors headers for fonts.
      {
        source: "*.woff2",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ]
  },
}

if (process.env.BASE_PATH) {
  config.basePath = process.env.BASE_PATH
}

module.exports = config
