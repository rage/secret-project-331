/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-var-requires */
const generateNormalResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").generateNormalResponseHeaders
const svgoConfig = require("./src/shared-module/common/utils/svgoConfig")

// Trusted types blocked on: https://github.com/vercel/next.js/issues/32209
const normalResponseHeaders = generateNormalResponseHeaders({ requireTrustedTypesFor: false })

/** @type {import('next').NextConfig} */
const config = {
  swcMinify: true,
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
  transpilePackages: ["@vectopus/atlas-icons-react", "highlight.js"],
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
