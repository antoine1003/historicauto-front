/**
 * Déclenche le téléchargement d'un document dont l'URL est absolutisée sur l'origine du back
 * (donc cross-origin par rapport au front).
 *
 * `download` sur un `<a>` est ignoré par les navigateurs pour une URL cross-origin : sans
 * `target="_blank"`, le clic navigue l'onglet courant vers le fichier et fait perdre à
 * l'exposant l'étape du formulaire où il se trouvait. `target="_blank"` ouvre un nouvel onglet à
 * la place, ce qui reste le meilleur comportement disponible tant que l'URL n'est pas
 * same-origin.
 */
export function downloadDocumentFile(fileUrl: string, label: string): void {
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = label.includes('.') ? label : `${label}.pdf`;
  a.target = '_blank';
  a.click();
}
