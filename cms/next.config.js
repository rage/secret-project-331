const config = {
  webpack(config, { dev, isServer }) {
    const aliases = config.resolve.alias || (config.resolve.alias = {})
    //aliases.react = aliases['react-dom'] = '@wordpress/element'
    return config
  },
}

if (process.env.BASE_PATH) {
  config.basePath = process.env.BASE_PATH
}

module.exports = config
