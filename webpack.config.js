const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

var config = {
    devtool: isProd ? 'source-map' : 'cheap-eval-source-map',
    context: path.resolve('./src'),
    entry: {
        app: './index.ts'
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].bundle.js',
        sourceMapFilename: '[name].map',
        devtoolModuleFilenameTemplate: function (info) {
            return "file:///" + info.absoluteResourcePath;
        }
    },
    module: {
        rules: [
            { enforce: 'pre', test: /\.ts$/, exclude: ["node_modules"], loader: 'ts-loader' },
            { test: /\.html$/, loader: "html-loader" },
            { test: /\.(glsl|vs|fs)$/, loader: 'shader-loader' },

        ]
    },
    resolve: {
        extensions: [".ts", ".js"],
        modules: [path.resolve('./src'), 'node_modules'],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(nodeEnv)
            }
        }),
        new HtmlWebpackPlugin({
            title: 'Origami',
            template: 'index.html'
        })
    ]
};



module.exports = config;