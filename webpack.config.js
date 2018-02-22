const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  target: 'node',
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
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
