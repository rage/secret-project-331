const path = require("path")
const fs = require("fs")
const { merge } = require("webpack-merge")
const svgoConfig = require("../src/utils/svgoConfig")
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  stories: ["../stories/**/*.stories.mdx", "../stories/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-storysource",
    "storybook-react-i18next",
  ],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  // webpackFinal: async (config) => {
  //   // this modifies the existing image rule to exclude .svg files
  //   // since we want to handle those files with @svgr/webpack
  //   if (!config.module) {
  //     throw new Error("The webpack config doesn't contain a module.")
  //   }
  //   if (!config.module.rules) {
  //     throw new Error("The webpack config module doesn't contain any rules.")
  //   }
  //   const imageRule = config.module.rules.find(ruleOrig => {
  //     const rule = ruleOrig as any
  //     if (Array.isArray(rule.test)) {
  //       return false
  //     }
  //     return rule.test.test('.svg')
  //   })
  //   if (imageRule) {
  //     (imageRule as any).exclude = /\.svg$/
  //   }



  //   return merge(config, {
  //     resolve: {
  //       alias: {
  //         "@emotion/core": getPackageDir("@emotion/react"),
  //         "@emotion/styled": getPackageDir("@emotion/styled"),
  //         "emotion-theming": getPackageDir("@emotion/react"),
  //       },
  //     },
  //     module: {
  //       rules: [
  //         {
  //           test: /\.svg$/i,
  //           issuer: /\.[jt]sx?$/,
  //           loader: "@svgr/webpack",
  //           options: {
  //             svgoConfig: svgoConfig,
  //           },
  //         },
  //         {
  //           test: /\.tsx?$/,
  //           use: 'ts-loader',
  //           exclude: /node_modules/,
  //         },
  //       ],
  //     },
  //   })
  // },
}

module.exports = config

function getPackageDir(p: string) {
  return path.dirname(require.resolve(path.join(p, "package.json")))
}
