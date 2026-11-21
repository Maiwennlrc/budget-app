import type { PdfTextItem } from '../lcl/parseReleve.ts'

/**
 * Lit un PDF directement dans le navigateur (aucun envoi sur internet)
 * et renvoie, pour chaque page, les morceaux de texte avec leur position.
 * pdf.js est chargé seulement au moment de l'import, pour que l'app démarre vite.
 */
export async function extractPdfText(file: File): Promise<PdfTextItem[][]> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const pages: PdfTextItem[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    const items: PdfTextItem[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width })
    }
    pages.push(items)
  }
  await task.destroy()
  return pages
}
