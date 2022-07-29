const path = require("path")
const fs = require("fs")
const { merge } = require("webpack-merge")

module.exports = {
  core: {
    builder: 'webpack5',
  },
  stories: ["../stories/**/*.stories.mdx", "../stories/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-storysource",
    "storybook-react-i18next",
  ],
  webpackFinal: async (config) => {
    // this modifies the existing image rule to exclude .svg files
    // since we want to handle those files with @svgr/webpack
    const imageRule = config.module.rules.find(rule => {
      if (Array.isArray(rule.test)) {
        return false
      }
      return rule.test.test('.svg')
    })
    imageRule.exclude = /\.svg$/


    return merge(config, {
      resolve: {
        alias: {
          "@emotion/core": getPackageDir("@emotion/react"),
          "@emotion/styled": getPackageDir("@emotion/styled"),
          "emotion-theming": getPackageDir("@emotion/react"),
        },
      },
      module: {
        rules: [
          {
            test: /\.svg$/i,
            issuer: /\.[jt]sx?$/,
            use: ["@svgr/webpack"],
          },
        ],
      },
    })
  },
}

function getPackageDir(package) {
  return path.dirname(require.resolve(path.join(package, "package.json")))
}
