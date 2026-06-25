import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const { items } = attributes;
	const blockProps = useBlockProps.save( { className: 'accordion-block' } );

	return (
		<div { ...blockProps }>
			{ items.map( ( item, index ) => (
				<div key={ index } className="accordion-item">
					<button
						className="accordion-trigger"
						aria-expanded="false"
						aria-controls={ `accordion-panel-${ index }` }
						id={ `accordion-btn-${ index }` }
						type="button"
					>
						<span>{ item.title }</span>
						<svg className="accordion-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					</button>
					<div
						className="accordion-panel"
						id={ `accordion-panel-${ index }` }
						role="region"
						aria-labelledby={ `accordion-btn-${ index }` }
						hidden
					>
						<RichText.Content
							tagName="div"
							className="accordion-panel-inner"
							value={ item.content }
						/>
					</div>
				</div>
			) ) }
		</div>
	);
}
