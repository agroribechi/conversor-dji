import JSZip from 'jszip';
import { injectDjiMetadata } from './djiXmpInjector';

const PROFILES = {
  mini3: { Model: 'Mavic 3M' },
  neo: { Model: 'Mavic 3M' },
  mavicpro: { Model: 'Mavic 3M' },
  default: { Model: 'Model Mavic 3M' }
};

// Helper para converter File em DataURL
const fileToDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Convert DataURL para Blob (para o arquivo ZIP)
const dataURLtoBlob = (dataurl) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Converte o lote de fotos diretamente na memória do navegador do cliente.
 * Injeta os metadados EXIF e XMP-drone-dji exigidos pelo DJI Smart Farm / DJI Terra.
 */
export const processBatchClientSide = async (files, profileName, onProgress) => {
  const profile = PROFILES[profileName] || PROFILES.default;
  const zip = new JSZip();

  let completed = 0;

  for (const file of files) {
    try {
      const originalDataUrl = await fileToDataURL(file);
      const modifiedDataUrl = injectDjiMetadata(originalDataUrl, profile.Model);
      const modifiedBlob = dataURLtoBlob(modifiedDataUrl);

      zip.file(file.name, modifiedBlob);
    } catch (err) {
      console.warn(`[Client-Side Converter] Não foi possível injetar XMP DJI em ${file.name}, adicionando original:`, err);
      zip.file(file.name, file);
    }

    completed++;
    if (onProgress) {
      onProgress(completed, files.length);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return URL.createObjectURL(zipBlob);
};
