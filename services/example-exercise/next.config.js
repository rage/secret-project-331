const path = require("path")

// Headers that allow this app to be embedded in a sandboxed iframe by the parent application.
// Permissive CSP is intentional: the iframe is sandboxed, which provides the isolation (see the
// sandbox attribute set by the parent's MessageChannelIFrame).
const externallyEmbeddableIFrameResponseHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "fullscreen=(self)" },
  {
    key: "Content-Security-Policy",
    value: "default-src * 'self' data: 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:",
  },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Access-Control-Allow-Private-Network", value: "true" },
  // The app runs inside a sandboxed iframe whose origin differs from the parent, so resources such
  // as API routes, fonts and dev files need permissive CORS.
  { key: "Access-Control-Allow-Origin", value: "*" },
]

const svgoConfig = {
  plugins: [
    {
      name: "preset-default",
      params: { overrides: { cleanupIds: { minify: false } } },
    },
    {
      name: "prefixIds",
      params: { prefixIds: true, prefixClassNames: false },
    },
  ],
}

/** @type {import('next').NextConfig} */
const config = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: externallyEmbeddableIFrameResponseHeaders,
      },
    ]
  },
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
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
    },
  },
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
