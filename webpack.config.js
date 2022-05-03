const path = require("path");
const MomentLocalesPlugin = require("moment-locales-webpack-plugin");
const PugPlugin = require("pug-plugin");

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.pug$/,
        loader: PugPlugin.loader,
      },
    ],
  },
  plugins: [
    // To strip all locales except “en”
    new MomentLocalesPlugin(),
    new PugPlugin(),
  ],
};
