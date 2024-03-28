import path from 'path';
import process from 'process';
import { Configuration } from "webpack";
import CopyPlugin from 'copy-webpack-plugin';

const isProduction = process.env.NODE_ENV === 'production';

const config: Configuration = {
    entry: {
        memesearch: './services/memesearch.js',
        tgPublisherBot: './services/servers/tg-bots/publisher/index.ts',
        tgPicsBot: './services/servers/tg-bots/pics/index.js',
        web: './services/servers/web/index.js',
    },
    mode: isProduction ? 'production' : 'development',
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: "./node_modules/**/*.wasm",
                    to: "[name][ext]"
                },
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: 'ts-loader',
                exclude: ['/node_modules/'],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js', '...'],
    
    },
    target: 'node',
};

export default config;
