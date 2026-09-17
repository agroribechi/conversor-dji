import * as piexifModule from 'piexifjs';
import JSZip from 'jszip';

// Garante compatibilidade do piexif com bundlers ES Module (Vite)
const piexif = piexifModule.default || piexifModule.piexif || piexifModule;

const PROFILES = {
  mini3: { Make: 'DJI', Model: 'Mavic 3M' },
  neo: { Make: 'DJI', Model: 'Mavic 3M' },
  mavicpro: { Make: 'DJI', Model: 'Mavic 3M' },
  default: { Make: 'DJI', Model: 'Mavic 3M' }
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
 * Nenhuma foto é enviada para o servidor!
 */
export const processBatchClientSide = async (files, profileName, onProgress) => {
  const profile = PROFILES[profileName] || PROFILES.default;
  const zip = new JSZip();

  let completed = 0;

  for (const file of files) {
    try {
      const originalDataUrl = await fileToDataURL(file);
      let exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };

      if (piexif && typeof piexif.load === 'function') {
        try {
          exifDict = piexif.load(originalDataUrl);
        } catch (e) {
          exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };
        }

        // Injeta marcas e modelo DJI nos metadados 0th IFD
        exifDict['0th'][piexif.ImageIFD.Make] = profile.Make;
        exifDict['0th'][piexif.ImageIFD.Model] = profile.Model;

        const exifBytes = piexif.dump(exifDict);
        const modifiedDataUrl = piexif.insert(exifBytes, originalDataUrl);
        const modifiedBlob = dataURLtoBlob(modifiedDataUrl);
        zip.file(file.name, modifiedBlob);
      } else {
        // Fallback caso piexif não carregue
        zip.file(file.name, file);
      }
    } catch (err) {
      console.warn(`[Client-Side Converter] Não foi possível injetar EXIF em ${file.name}, mantendo arquivo original:`, err);
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
