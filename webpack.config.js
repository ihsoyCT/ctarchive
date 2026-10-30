const path = require("path");

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
        loader: path.resolve(__dirname, "pug-loader.js"),
      },
    ],
  },
};
