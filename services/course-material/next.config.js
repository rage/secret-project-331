/* eslint-disable i18next/no-literal-string */

const headers = [
  {
    key: "backend",
    value: "course-material",
  },
]
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: "/(.*)",
        headers: headers,
      },
    ]
  },
  assetPrefix: "/courses",
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = withBundleAnalyzer(config)
