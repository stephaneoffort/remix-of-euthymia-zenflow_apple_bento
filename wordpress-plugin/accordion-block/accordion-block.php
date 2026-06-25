<?php
/**
 * Plugin Name: Accordion Block
 * Description: Bloc Gutenberg accordéon avec titres illimités et texte enrichi (gras, italique, liens).
 * Version: 1.0.0
 * Author: Stéphane Offort
 * Text Domain: accordion-block
 */

defined( 'ABSPATH' ) || exit;

function accordion_block_register() {
	register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'accordion_block_register' );
