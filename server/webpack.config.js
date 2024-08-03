const path = require('path');

module.exports = {
  entry: './src/codebrowser.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    globalObject: 'this',
    library: {
      name: 'CodeBrowser',
      type: 'umd',
    },
  },
};