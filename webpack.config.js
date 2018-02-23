const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  target: 'node',
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    library: 'chainpoint-client',
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
