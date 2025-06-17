const externallyEmbeddableIFrameResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").externallyEmbeddableIFrameResponseHeaders
const svgoConfig = require("./src/shared-module/common/utils/svgoConfig")

/** @type {import('next').NextConfig} */
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
  // The dev indicators don't work inside sandboxed IFrames as they try to access localstorage, which is not allowed without the allow-same-origin option.
  devIndicators: false,
  // This program is used inside sandboxed iframes so the origin of requests to the _next folder will be null.
  allowedDevOrigins: ["*", "project-331.local"],
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

// eslint-disable-next-line import/order
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = withBundleAnalyzer(config)
