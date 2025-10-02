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
  // The dev indicators don't work inside sandboxed IFrames as they try to access localstorage, which is not allowed without the allow-same-origin option.
  devIndicators: false,
  // This program is used inside sandboxed iframes so the origin of request to the _next folder will be different from the origin of the page.
  allowedDevOrigins: ["*", "project-331.local"],
  // This is open source, so no need to hide the code
  productionBrowserSourceMaps: true,
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
