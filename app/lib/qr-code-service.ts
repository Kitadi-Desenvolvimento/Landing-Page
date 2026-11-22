export function getProductQRCodeUrl(siteUrl: string, slug?: string): string {
  const site = new URL(siteUrl);
  if (!["https:", "http:"].includes(site.protocol) || site.username || site.password) {
    throw new Error("O endereço público do site deve usar HTTP ou HTTPS.");
  }

  if (slug !== undefined && (!slug.trim() || slug === "." || slug === "..")) {
    throw new Error("O produto deve ter um slug válido.");
  }

  const pathname = slug === undefined ? "/produtos" : `/produtos/${encodeURIComponent(slug)}`;
  return new URL(pathname, site.origin).href;
}

export async function generateQRCode(url: string): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(url, {
    type: "image/png",
    // A biblioteca arredonda para baixo com erro de vírgula flutuante (1023px); a meia unidade garante 1024px.
    width: 1024.5,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

export const qrLogoSource = "/kitadi-logo.png";
const qrLogoContent = { x: 66, y: 61, width: 1050, height: 373 };
const qrLogoBadgeColor = "#000000";
const qrLogoInkColor = "#ffffff";

/** O selo ocupa ~5% da área do QR, bem abaixo dos 30% que o nível H recupera. */
export function getQrLogoLayout(size: number) {
  const badgeWidth = Math.round(size * 0.32);
  const padding = Math.round(badgeWidth * 0.09);
  const logoWidth = badgeWidth - padding * 2;
  const logoHeight = Math.round((logoWidth * qrLogoContent.height) / qrLogoContent.width);
  const badgeHeight = logoHeight + padding * 2;
  return {
    rim: Math.round(size * 0.012),
    radius: Math.round(badgeHeight * 0.18),
    badge: {
      x: Math.round((size - badgeWidth) / 2),
      y: Math.round((size - badgeHeight) / 2),
      width: badgeWidth,
      height: badgeHeight,
    },
    logo: {
      x: Math.round((size - logoWidth) / 2),
      y: Math.round((size - logoHeight) / 2),
      width: logoWidth,
      height: logoHeight,
    },
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = src;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawLogoBadge(context: CanvasRenderingContext2D, logo: HTMLImageElement, size: number) {
  const layout = getQrLogoLayout(size);
  const { badge } = layout;
  context.fillStyle = "#ffffff";
  roundedRect(
    context,
    badge.x - layout.rim,
    badge.y - layout.rim,
    badge.width + layout.rim * 2,
    badge.height + layout.rim * 2,
    layout.radius + layout.rim,
  );
  context.fillStyle = qrLogoBadgeColor;
  roundedRect(context, badge.x, badge.y, badge.width, badge.height, layout.radius);
  context.drawImage(
    tintLogo(logo),
    0,
    0,
    qrLogoContent.width,
    qrLogoContent.height,
    layout.logo.x,
    layout.logo.y,
    layout.logo.width,
    layout.logo.height,
  );
}

/** Recorta o logo e pinta-o de branco, mantendo a transparência original. */
function tintLogo(logo: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = qrLogoContent.width;
  canvas.height = qrLogoContent.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível.");
  context.drawImage(
    logo,
    qrLogoContent.x,
    qrLogoContent.y,
    qrLogoContent.width,
    qrLogoContent.height,
    0,
    0,
    qrLogoContent.width,
    qrLogoContent.height,
  );
  context.globalCompositeOperation = "source-in";
  context.fillStyle = qrLogoInkColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Só no browser. Devolve o QR com o logo da Kitadi ao centro.
 * Se o logo não carregar ou o canvas falhar, devolve o QR simples, que continua válido.
 */
export async function generateBrandedQRCode(url: string): Promise<string> {
  const plain = await generateQRCode(url);
  try {
    const [qr, logo] = await Promise.all([loadImage(plain), loadImage(qrLogoSource)]);
    const canvas = document.createElement("canvas");
    canvas.width = qr.naturalWidth;
    canvas.height = qr.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return plain;

    context.drawImage(qr, 0, 0);
    drawLogoBadge(context, logo, canvas.width);
    return canvas.toDataURL("image/png");
  } catch {
    return plain;
  }
}
