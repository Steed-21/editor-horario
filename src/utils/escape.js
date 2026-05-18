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
