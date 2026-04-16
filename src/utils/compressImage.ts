export async function compressImage(
  file: File,
  maxWidth = 2400,
  maxHeight = 2400,
  quality = 0.85,
  maxMB = 8,
): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      let q = quality;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            if (blob.size > maxMB * 1024 * 1024 && q > 0.6) {
              q -= 0.05;
              tryCompress();
            } else {
              resolve(
                new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                  type: "image/jpeg",
                }),
              );
            }
          },
          "image/jpeg",
          q,
        );
      };
      tryCompress();
    };
    img.src = url;
  });
}
