import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';

const isProd = process.env.NODE_ENV === 'production';

export const mainConfig: Configuration = {
  entry: './src/main/main.ts',
  target: 'electron-main',
  devtool: isProd ? false : 'source-map',
  mode: isProd ? 'production' : 'development',
  module: { rules },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimization: {
    minimize: isProd,
    usedExports: true,
    concatenateModules: isProd,
  },
  ...(isProd && {
    stats: {
      warnings: false,
    },
    performance: {
      hints: false,
    },
  }),
};
