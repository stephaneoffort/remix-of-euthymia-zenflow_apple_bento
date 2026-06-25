const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		index: './src/index.js',
		'style-index': './src/style-index.js',
		view: './src/view.js',
	},
};
