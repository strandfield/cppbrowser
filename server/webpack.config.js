const path = require('path');

module.exports = {
  entry: './src/cxxparser.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    globalObject: 'this',
    library: {
      name: 'cxxParser',
      type: 'umd',
    },
  },
};