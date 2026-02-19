import type { Configuration, Compiler } from 'webpack';
import { rules } from './webpack.rules';

class FixDirnamePlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('FixDirnamePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'FixDirnamePlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          for (const [name, source] of Object.entries(assets)) {
            if (!name.endsWith('.js')) continue;
            const content = source.source().toString();
            if (content.includes('__webpack_require__.ab = __dirname +')) {
              const outputPath = compiler.options.output?.path || '/';
              const fixed = content.replace(
                '__webpack_require__.ab = __dirname +',
                `__webpack_require__.ab = ${JSON.stringify(outputPath)} +`,
              );
              compilation.updateAsset(
                name,
                new compiler.webpack.sources.RawSource(fixed),
              );
            }
          }
        },
      );
    });
  }
}

export const rendererConfig: Configuration = {
  devtool: 'source-map',
  module: {
    rules: [
      ...rules,
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|webp)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new FixDirnamePlugin(),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
