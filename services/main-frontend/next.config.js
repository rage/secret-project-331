const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  i18n: {
    locales: ["en-US", "fi-FI"],
    defaultLocale: process.env.DEFAULT_LOCALE ?? "en-US",
  },
}

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  config.basePath = process.env.NEXT_PUBLIC_BASE_PATH
}

module.exports = config
