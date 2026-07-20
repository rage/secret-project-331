const generateNormalResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").generateNormalResponseHeaders
const svgoConfig = require("./src/shared-module/common/utils/svgoConfig")

const normalResponseHeaders = generateNormalResponseHeaders()

/**
 * @type {import('next').NextConfig}
 */
const config = {
  // Type errors are gated by the separate fast tsc check (bin/tsc-check-all + the CI
  // "Typecheck" step), so skip Next's slower in-build type-check.
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  outputFileTracingRoot: __dirname,
  // oxlint-disable-next-line require-await -- Next.js config headers() type expects a Promise-returning function
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: normalResponseHeaders,
      },
    ]
  },
  webpack(webpackConfig) {
    webpackConfig.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      loader: "@svgr/webpack",
      options: {
        svgoConfig: svgoConfig,
        svgProps: { role: "presentation" },
      },
    })

    // Support webassembly
    webpackConfig.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm"
    webpackConfig.experiments = { asyncWebAssembly: true, layers: true }

    return webpackConfig
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              svgoConfig: svgoConfig,
              svgProps: { role: "presentation" },
            },
          },
        ],
        as: "*.js",
      },
    },
  },
  compiler: {
    emotion: {
      autoLabel: "always",
      // https://github.com/vercel/next.js/issues/40091
      // labelFormat: "[dirname]--[filename]--[local]",
    },
  },

  modularizeImports: {
    lodash: {
      transform: "lodash/{{member}}",
    },
  },
  transpilePackages: ["@vectopus/atlas-icons-react"],
  allowedDevOrigins: ["project-331.local"],
  // This is open source, so no need to hide the code
  productionBrowserSourceMaps: true,
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
