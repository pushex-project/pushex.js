const path = require("path")
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin")

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "pushex.js",
    path: path.resolve(__dirname, "dist"),
    library: "Pushex",
    libraryTarget: "umd"
  },
  devtool: "cheap-module-source-map",
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.[jt]s$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  },
  plugins: [new ForkTsCheckerWebpackPlugin()]
}
