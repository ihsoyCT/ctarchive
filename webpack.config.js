const path = require('path');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.pug$/,
        loader:'pug-loader',
      },
    ],
  },
  plugins: [
    // To strip all locales except “en”
    new MomentLocalesPlugin(),
  ]
};
