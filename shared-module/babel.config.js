/* eslint-disable i18next/no-literal-string */
module.exports = {
  presets: [["@babel/preset-react", { runtime: "automatic", importSource: "@emotion/react" }]],
  plugins: ["@emotion/babel-plugin", "inline-react-svg"],
}

if (process.env.NODE_ENV === "test") {
  module.exports.presets.push(["@babel/preset-env", { targets: { node: "current" } }])
  module.exports.presets.push("@babel/preset-typescript")
}
