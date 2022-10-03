/* eslint-disable i18next/no-literal-string */
const config = {
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          prefixIds: {
            prefixIds: true,
            prefixClassNames: false,
          },
          cleanupIDs: {
            minify: false,
          },
        },
      },
    },
  ],
}

module.exports = config
