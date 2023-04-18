/* eslint-disable i18next/no-literal-string */
const config = {
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: {
            minify: false,
          },
        },
      },
    },
    {
      name: "prefixIds",
      params: {
        prefixIds: true,
        prefixClassNames: false,
      },
    },
  ],
}

module.exports = config
