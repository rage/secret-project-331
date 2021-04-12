module.exports = {
  webpack(config, { dev, isServer }) {
    const aliases = config.resolve.alias || (config.resolve.alias = {})
    //aliases.react = aliases['react-dom'] = '@wordpress/element'
    return config
  },
}
