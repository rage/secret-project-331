/* eslint-disable i18next/no-literal-string */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin")

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
  webpack: (config, _options) => {
    config.module.plugins.push(
      new MonacoWebpackPlugin({
        // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
        languages: ["json"],
      }),
    )
    return config
  },
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
