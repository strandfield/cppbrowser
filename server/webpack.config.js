const path = require('path');

module.exports = {
  entry: './src/codebrowser.js',
  output: {
    path: path.resolve(__dirname, 'dist/ui/static'),
    filename: 'bundle.js',
    globalObject: 'this',
    library: {
      name: 'CodeBrowser',
      type: 'umd',
    },
  },
};