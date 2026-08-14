/* oxlint-disable import/order */
const generateNormalResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").generateNormalResponseHeaders
const chatbotEmbedResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").chatbotEmbedResponseHeaders
const svgoConfig = require("./src/shared-module/common/utils/svgoConfig")

// Trusted types blocked on: https://github.com/vercel/next.js/issues/32209
const normalResponseHeaders = generateNormalResponseHeaders({ requireTrustedTypesFor: false })

/** @type {import('next').NextConfig} */
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Type errors are gated by the separate fast tsc check (bin/tsc-check-all + the CI
  // "Typecheck" step), so skip Next's slower in-build type-check.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Next's CLI type-check mode requires typescript/bin/tsc, which our `typescript` ->
    // @typescript/typescript6 alias does not provide (it ships bin/tsc6). Its API mode
    // resolves the alias fine, and the build skips type-checking anyway.
    useTypeScriptCli: false,
  },
  output: "standalone",
  outputFileTracingRoot: ".",
  // oxlint-disable-next-line require-await -- Next.js config expects headers() to return a Promise
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: normalResponseHeaders,
      },
      {
        source: "/chatbot-embed/:id",
        headers: chatbotEmbedResponseHeaders,
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
    resolveAlias: {
      // @citation-js/core statically imports node-fetch, which requires node:fs/node:net
      // (via fetch-blob) even though citation-js only calls it outside the browser. Turbopack
      // refuses to bundle those for the client, so alias it to a fetch()-based shim there.
      "node-fetch": { browser: "./src/shims/browserNodeFetch.js" },
    },
  },
  compiler: {
    emotion: {
      // Must stay "never" while any `css` template interpolates another @emotion/css class name
      // (~25 sites). Emotion inlines the interpolated class's raw registered string, label marker
      // included, so autoLabel injects `label:foo` into the middle of the CSS. Next <=16.2 emitted
      // a bare `foo`, which parsed as an unknown element selector and was harmless; 16.3 emits
      // `label:foo`, an unknown pseudo-class that invalidates the whole selector list and silently
      // drops the rule — which cost us the global `html, body` font-family and the css reset.
      autoLabel: "never",
      // https://github.com/vercel/next.js/issues/40091
      // labelFormat: "[dirname]--[filename]--[local]",
    },
  },

  modularizeImports: {
    lodash: {
      transform: "lodash/{{member}}",
    },
  },
  publicRuntimeConfig: {
    publicAddress: process.env.PUBLIC_ADDRESS,
  },
  transpilePackages: ["@vectopus/atlas-icons-react"],
  allowedDevOrigins: ["project-331.local"],
  // This is open source, so no need to hide the code
  productionBrowserSourceMaps: true,
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = withBundleAnalyzer(config)
