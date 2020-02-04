const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

let base = {
  entry: ['@babel/polyfill', '@ungap/url-search-params', './index.js'],
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-object-rest-spread', '@babel/plugin-transform-regenerator']
          }
        }
      }
    ]
  }
}

let web = {
  entry: ['@babel/polyfill', './index.js'],
  target: 'web',
  node: {
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    dns: 'empty',
    tls: 'empty'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.web.js',
    library: 'chainpointClient',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  plugins: [
    new webpack.ProvidePlugin({
      chainpointClient: 'chainpointClient'
    })
  ]
}

let node = {
  target: 'node',
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    library: 'chainpointClient',
    libraryTarget: 'umd',
    umdNamedDefine: true
  }
}

module.exports = [Object.assign({}, base, web), Object.assign({}, base, node)]
