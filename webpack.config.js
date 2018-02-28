const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

let base = {
  entry: './index.js',
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: [
            ['env', {
              targets: {
                node: true,
                'browsers': ['last 2 versions', 'safari >= 7']
              },
              // for uglifyjs...
              forceAllTransforms: true
            }]
          ]
        }
      }
    ]
  },
  plugins: [
    new UglifyJSPlugin()
  ]
}

let web = {
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
  }
}

let node = {
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    library: 'chainpointClient',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: [
            ['env', {
              targets: {
                node: true
              },
              // for uglifyjs...
              forceAllTransforms: true
            }]
          ]
        }
      }
    ]
  }
}

module.exports = [Object.assign({}, base, web), Object.assign({}, base, node)]
