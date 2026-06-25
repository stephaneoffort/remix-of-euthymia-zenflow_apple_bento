import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';
import metadata from '../block.json';
import './editor.scss';

registerBlockType( metadata.name, {
	edit: Edit,
	save,
} );
