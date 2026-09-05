import { api } from './api';

/**
 * Téléchargement du pack de codes QR.
 *
 * Le PDF est derrière une route authentifiée : on ne peut pas se contenter d'un lien. On le
 * récupère avec le jeton, puis on déclenche la sauvegarde côté navigateur.
 */
export async function downloadPdf(
  format: 'a6' | 'a4',
  onError?: (message: string) => void,
  ids?: string[],
): Promise<void> {
  try {
    const query = new URLSearchParams({ format });
    if (ids && ids.length > 0) query.set('ids', ids.join(','));

    const blob = await api.blob(`/access-points/pdf?${query.toString()}`);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `codes-qr-${format}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();

    // Laisser au navigateur le temps d'ouvrir le fichier avant de libérer l'URL.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    onError?.("Le pack n'a pas pu être préparé. Réessayez dans un instant.");
  }
}
