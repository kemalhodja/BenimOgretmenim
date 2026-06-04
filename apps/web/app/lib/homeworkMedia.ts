export type HomeworkImageAttachment = {
  id: string;
  name: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  dataUrl: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel işlenemedi."));
    img.src = src;
  });
}

export async function prepareHomeworkImage(file: File): Promise<HomeworkImageAttachment> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Yalnızca JPEG, PNG veya WebP görsel yükleyin.");
  }
  if (file.size > 6_000_000) {
    throw new Error("Görsel 6 MB üstünde; önce küçültün.");
  }

  const sourceDataUrl = await fileToDataUrl(file);
  const img = await loadImage(sourceDataUrl);
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel sıkıştırma desteklenmiyor.");
  ctx.drawImage(img, 0, 0, width, height);

  const mime = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  let dataUrl = canvas.toDataURL(mime, 0.78);
  if (dataUrl.length > 390_000 && mime !== "image/jpeg") {
    dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  }
  if (dataUrl.length > 390_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.58);
  }
  if (dataUrl.length > 430_000) {
    throw new Error("Görsel sıkıştırıldıktan sonra hâlâ büyük. Daha net kırpılmış bir fotoğraf deneyin.");
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name || "soru-gorseli",
    mime: dataUrl.startsWith("data:image/webp") ? "image/webp" : dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
    size: Math.round((dataUrl.length * 3) / 4),
    dataUrl,
  };
}
