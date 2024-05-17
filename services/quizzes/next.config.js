/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-var-requires */
const externallyEmbeddableIFrameResponseHeaders =
  require("@/shared-module/common/utils/responseHeaders").externallyEmbeddableIFrameResponseHeaders
const svgoConfig = require("@/shared-module/common/utils/svgoConfig")

const config = {
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: externallyEmbeddableIFrameResponseHeaders,
      },
    ]
  },
  output: "standalone",
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      loader: "@svgr/webpack",
      options: {
        svgoConfig: svgoConfig,
        svgProps: { role: "presentation" },
      },
    })

    return config
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
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

// eslint-disable-next-line import/order
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = withBundleAnalyzer(config)
