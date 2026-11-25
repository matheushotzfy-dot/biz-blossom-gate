/**
 * Recorta a foto de perfil em quadrado e reduz para 512 px (JPEG). A foto cabe em poucos KB,
 * carrega rápido no topo da plataforma e não depende do tamanho da câmera do celular.
 * Devolve null quando o navegador não consegue decodificar a imagem; quem chama decide o que fazer.
 */
export async function squareAvatarBlob(file: File, size = 512): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    if (!side) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira JPEG: o fundo precisa ser uma cor
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
    bmp.close?.();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  } catch {
    return null;
  }
}
