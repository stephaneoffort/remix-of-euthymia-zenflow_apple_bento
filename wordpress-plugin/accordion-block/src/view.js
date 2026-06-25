/* Script exécuté côté visiteur pour animer l'accordéon */
document.querySelectorAll( '.accordion-block' ).forEach( ( block ) => {
	block.querySelectorAll( '.accordion-trigger' ).forEach( ( btn ) => {
		btn.addEventListener( 'click', () => {
			const expanded = btn.getAttribute( 'aria-expanded' ) === 'true';
			const panel = document.getElementById( btn.getAttribute( 'aria-controls' ) );

			btn.setAttribute( 'aria-expanded', String( ! expanded ) );

			if ( expanded ) {
				panel.hidden = true;
			} else {
				panel.hidden = false;
			}
		} );
	} );
} );
