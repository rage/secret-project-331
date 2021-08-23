const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
}

if (process.env.BASE_PATH) {
  config.basePath = process.env.BASE_PATH
}

module.exports = config
