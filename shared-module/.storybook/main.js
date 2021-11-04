const path = require("path");
const fs = require("fs");
const { merge } = require("webpack-merge");

module.exports = {
  "stories": [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    '@storybook/addon-a11y',
    '@storybook/addon-storysource',
    'storybook-react-i18next'
  ],
  webpackFinal: async (config) => {
    return merge(config, {
      resolve: {
        alias: {
          "@emotion/core": getPackageDir("@emotion/react"),
          "@emotion/styled": getPackageDir("@emotion/styled"),
          "emotion-theming": getPackageDir("@emotion/react"),
        },
      },
    });
  },
}

function getPackageDir(package) {
  return path.dirname(require.resolve(path.join(package, 'package.json')))
}
