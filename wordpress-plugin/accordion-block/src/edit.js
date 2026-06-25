import { __ } from '@wordpress/i18n';
import { useBlockProps, RichText } from '@wordpress/block-editor';
import { Button, TextControl } from '@wordpress/components';

export default function Edit( { attributes, setAttributes } ) {
	const { items } = attributes;
	const blockProps = useBlockProps( { className: 'accordion-block-editor' } );

	function updateItem( index, field, value ) {
		const updated = items.map( ( item, i ) =>
			i === index ? { ...item, [ field ]: value } : item
		);
		setAttributes( { items: updated } );
	}

	function addItem() {
		setAttributes( {
			items: [ ...items, { title: __( 'Nouveau titre', 'accordion-block' ), content: '' } ],
		} );
	}

	function removeItem( index ) {
		setAttributes( { items: items.filter( ( _, i ) => i !== index ) } );
	}

	function moveItem( index, direction ) {
		const updated = [ ...items ];
		const target = index + direction;
		if ( target < 0 || target >= updated.length ) return;
		[ updated[ index ], updated[ target ] ] = [ updated[ target ], updated[ index ] ];
		setAttributes( { items: updated } );
	}

	return (
		<div { ...blockProps }>
			{ items.map( ( item, index ) => (
				<div key={ index } className="accordion-item-editor">
					<div className="accordion-item-header-row">
						<TextControl
							className="accordion-title-input"
							placeholder={ __( 'Titre…', 'accordion-block' ) }
							value={ item.title }
							onChange={ ( val ) => updateItem( index, 'title', val ) }
						/>
						<div className="accordion-item-controls">
							<Button
								icon="arrow-up-alt2"
								isSmall
								disabled={ index === 0 }
								onClick={ () => moveItem( index, -1 ) }
								label={ __( 'Monter', 'accordion-block' ) }
							/>
							<Button
								icon="arrow-down-alt2"
								isSmall
								disabled={ index === items.length - 1 }
								onClick={ () => moveItem( index, 1 ) }
								label={ __( 'Descendre', 'accordion-block' ) }
							/>
							<Button
								icon="trash"
								isSmall
								isDestructive
								disabled={ items.length === 1 }
								onClick={ () => removeItem( index ) }
								label={ __( 'Supprimer', 'accordion-block' ) }
							/>
						</div>
					</div>
					<RichText
						tagName="div"
						className="accordion-content-editor"
						placeholder={ __( 'Contenu… (gras, italique, liens disponibles)', 'accordion-block' ) }
						value={ item.content }
						onChange={ ( val ) => updateItem( index, 'content', val ) }
						allowedFormats={ [
							'core/bold',
							'core/italic',
							'core/link',
							'core/underline',
						] }
						multiline={ false }
					/>
				</div>
			) ) }
			<Button
				variant="primary"
				onClick={ addItem }
				className="accordion-add-item"
			>
				{ __( '+ Ajouter un élément', 'accordion-block' ) }
			</Button>
		</div>
	);
}
