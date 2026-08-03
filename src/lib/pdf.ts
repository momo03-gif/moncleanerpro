// Génère un PDF A4 à partir d'un élément DOM et le télécharge directement (sans
// passer par la fenêtre d'impression). Les librairies sont chargées À LA DEMANDE
// (dynamic import) pour ne pas alourdir le bundle des pages.
export async function downloadElementPdf(el: HTMLElement, filename: string): Promise<void> {
  const [h2cMod, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const html2canvas = (h2cMod as unknown as { default: (e: HTMLElement, o?: object) => Promise<HTMLCanvasElement> }).default;
  const JsPDF = (jspdfMod as unknown as { jsPDF: new (o?: object) => any }).jsPDF;

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#FFFFFF', useCORS: true });
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();    // 210 mm
  const pageH = pdf.internal.pageSize.getHeight();   // 297 mm
  const margin = 10;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const imgH = (canvas.height * usableW) / canvas.width;  // hauteur de l'image mise à l'échelle

  // Tolérance « une seule page » : un document qui dépasse de peu (marge de 20 %)
  // est réduit pour tenir sur la page plutôt que de générer une 2ᵉ page presque
  // vide, avec une ligne coupée en deux au passage. En dessous de ce seuil la
  // réduction reste invisible à l'œil ; au-delà, on pagine vraiment.
  const FIT_TOLERANCE = 1.2;

  if (imgH <= usableH) {
    // Tient sur une seule page.
    pdf.addImage(imgData, 'JPEG', margin, margin, usableW, imgH);
  } else if (imgH <= usableH * FIT_TOLERANCE) {
    // Léger dépassement → on réduit à la hauteur utile (largeur ajustée pour
    // conserver les proportions, document centré horizontalement).
    const fitH = usableH;
    const fitW = (canvas.width * fitH) / canvas.height;
    pdf.addImage(imgData, 'JPEG', (pageW - fitW) / 2, margin, fitW, fitH);
  } else {
    // Contenu plus haut qu'une page → on répète l'image en la décalant vers le haut.
    let heightLeft = imgH;
    let position = margin;
    pdf.addImage(imgData, 'JPEG', margin, position, usableW, imgH);
    heightLeft -= usableH;
    while (heightLeft > 0) {
      position = margin - (imgH - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, usableW, imgH);
      heightLeft -= usableH;
    }
  }
  pdf.save(filename);
}
