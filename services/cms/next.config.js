const path = require("path")

const generateNormalResponseHeaders =
  require("./src/shared-module/common/utils/responseHeaders").generateNormalResponseHeaders
const svgoConfig = require("./src/shared-module/common/utils/svgoConfig")

const normalResponseHeaders = generateNormalResponseHeaders()

// @wordpress/format-library ships build-style/style.css, but unlike the other @wordpress packages we
// import stylesheets from, its package exports map has no ./build-style/* entry — so the specifier
// resolves only through this alias. Imported by src/components/editors/GutenbergEditor.tsx.
const FORMAT_LIBRARY_STYLESHEET = "@wordpress/format-library/build-style/style.css"

/**
 * @type {import('next').NextConfig}
 */
const config = {
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
    webpackConfig.resolve.alias[`${FORMAT_LIBRARY_STYLESHEET}$`] = path.join(
      __dirname,
      "node_modules",
      FORMAT_LIBRARY_STYLESHEET,
    )

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
    resolveAlias: {
      [FORMAT_LIBRARY_STYLESHEET]: `./node_modules/${FORMAT_LIBRARY_STYLESHEET}`,
    },
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
      // See services/main-frontend/next.config.js: autoLabel must stay "never" while `css`
      // templates interpolate other @emotion/css class names, or Next 16.3+ injects `label:foo`
      // mid-CSS and the surrounding rule is silently dropped.
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
  transpilePackages: ["@vectopus/atlas-icons-react"],
  allowedDevOrigins: ["project-331.local"],
  // This is open source, so no need to hide the code
  productionBrowserSourceMaps: true,
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
