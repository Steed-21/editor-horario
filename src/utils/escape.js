// Escapa texto para inserción segura en innerHTML / atributos HTML.
// Cubre & < > " ' para prevenir XSS desde nombres de empleado, abrev. de turno, etc.
export function escapeHTML(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Alias corto para usar en template strings.
export const esc = escapeHTML;

// Encode a JavaScript string literal, then its containing HTML attribute.
// HTML escaping alone is insufficient because entities decode before execution.
export const jsArg = value => esc(JSON.stringify(String(value)));
