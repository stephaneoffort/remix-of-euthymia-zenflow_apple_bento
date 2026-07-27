import DOMPurify from 'dompurify';

/**
 * Force les liens externes à s'ouvrir dans un nouvel onglet sans fuite de referrer.
 */
let hookRegistered = false;
function ensureHook() {
  if (hookRegistered) return;
  hookRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node && (node as Element).tagName === 'A') {
      (node as Element).setAttribute('target', '_blank');
      (node as Element).setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/** Balises autorisées pour le contenu produit par l'éditeur riche (commentaires, mentions). */
const RICH_TEXT_ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'hr',
];

const RICH_TEXT_ALLOWED_ATTR = ['href', 'title', 'class', 'data-id', 'data-type', 'data-label'];

/**
 * Nettoie le HTML issu de l'éditeur riche (commentaires de tâches, mentions).
 */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'link', 'base'],
    FORBID_ATTR: ['style', 'srcset', 'formaction', 'ping'],
  });
}

/** Balises autorisées pour les e-mails reçus (mise en forme riche, images, tableaux). */
const EMAIL_ALLOWED_TAGS = [
  ...RICH_TEXT_ALLOWED_TAGS,
  'img', 'figure', 'figcaption', 'small', 'big', 'font', 'center',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'dl', 'dt', 'dd', 'abbr', 'cite', 'q', 'time', 'address',
];

const EMAIL_ALLOWED_ATTR = [
  'href', 'title', 'alt', 'src', 'width', 'height', 'align', 'valign',
  'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border', 'class', 'dir', 'lang',
];

/**
 * Neutralise les couleurs héritées de l'e-mail pour garantir un contraste lisible
 * dans les thèmes clair et sombre. S'applique APRÈS l'assainissement.
 */
function stripColors(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.removeAttribute('color');
    el.removeAttribute('bgcolor');
    el.removeAttribute('text');
    const style = el.getAttribute('style');
    if (style) {
      const cleaned = style
        .replace(/(^|;)\s*color\s*:[^;]*/gi, '$1')
        .replace(/(^|;)\s*background(-color)?\s*:[^;]*/gi, '$1')
        .replace(/;;+/g, ';')
        .replace(/^\s*;/, '')
        .trim();
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    }
  });
}

/**
 * Nettoie le HTML d'un e-mail reçu (source externe non fiable) :
 * suppression des scripts, gestionnaires d'événements, URLs javascript:,
 * iframes/objets et balises de redirection, puis neutralisation des couleurs.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  ensureHook();
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: [...EMAIL_ALLOWED_ATTR, 'style'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base', 'style'],
    FORBID_ATTR: ['srcset', 'formaction', 'ping', 'background'],
    RETURN_DOM_FRAGMENT: false,
  });

  // Post-traitement DOM (jamais rattaché au document) pour retirer les couleurs.
  const container = document.createElement('div');
  container.innerHTML = clean;
  stripColors(container);
  return container.innerHTML;
}
