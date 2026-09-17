import piexif from 'piexifjs';

const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

/**
 * Converte graus decimais para o formato de Graus, Minutos e Segundos (DMS) do EXIF
 */
const degToDmsRational = (deg) => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60 * 100);
  return [[degrees, 1], [minutes, 1], [seconds, 100]];
};

/**
 * Extrai coordenadas GPS originais da imagem
 */
const extractGpsCoords = (exifDict) => {
  let lat = null;
  let lon = null;
  let alt = null;

  try {
    const gps = exifDict['GPS'];
    if (gps) {
      if (gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLatitude].length === 3) {
        const dms = gps[piexif.GPSIFD.GPSLatitude];
        const ref = gps[piexif.GPSIFD.GPSLatitudeRef] || 'N';
        const deg = (dms[0][0] / (dms[0][1] || 1)) + (dms[1][0] / (dms[1][1] || 1)) / 60 + (dms[2][0] / (dms[2][1] || 1)) / 3600;
        lat = (ref === 'S' ? -1 : 1) * deg;
      }
      if (gps[piexif.GPSIFD.GPSLongitude] && gps[piexif.GPSIFD.GPSLongitude].length === 3) {
        const dms = gps[piexif.GPSIFD.GPSLongitude];
        const ref = gps[piexif.GPSIFD.GPSLongitudeRef] || 'E';
        const deg = (dms[0][0] / (dms[0][1] || 1)) + (dms[1][0] / (dms[1][1] || 1)) / 60 + (dms[2][0] / (dms[2][1] || 1)) / 3600;
        lon = (ref === 'W' ? -1 : 1) * deg;
      }
      if (gps[piexif.GPSIFD.GPSAltitude]) {
        const altRational = gps[piexif.GPSIFD.GPSAltitude];
        alt = altRational[0] / (altRational[1] || 1);
      }
    }
  } catch (e) {
    console.warn('[XMP Injector] Erro ao ler GPS original:', e);
  }

  return { 
    lat: (lat !== null && !isNaN(lat)) ? lat : -15.7801, 
    lon: (lon !== null && !isNaN(lon)) ? lon : -47.9292, 
    alt: (alt !== null && !isNaN(alt)) ? alt : 120.0 
  };
};

/**
 * Cria o bloco de XML XMP nativo exigido pelo DJI Smart Farm / DJI Terra
 */
const createDjiXmpXml = (lat, lon, alt) => {
  const latStr = lat >= 0 ? `+${lat.toFixed(7)}` : `${lat.toFixed(7)}`;
  const lonStr = lon >= 0 ? `+${lon.toFixed(7)}` : `${lon.toFixed(7)}`;
  const altStr = alt >= 0 ? `+${alt.toFixed(2)}` : `${alt.toFixed(2)}`;

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/"
    drone-dji:AbsoluteAltitude="${altStr}"
    drone-dji:RelativeAltitude="${altStr}"
    drone-dji:GpsLatitude="${latStr}"
    drone-dji:GpsLongitude="${lonStr}"
    drone-dji:GimbalPitchDegree="-90.00"
    drone-dji:GimbalYawDegree="0.00"
    drone-dji:GimbalRollDegree="0.00"
    drone-dji:FlightPitchDegree="0.00"
    drone-dji:FlightYawDegree="0.00"
    drone-dji:FlightRollDegree="0.00"
    drone-dji:RtkFlag="1"
    drone-dji:RtkStdLon="0.015"
    drone-dji:RtkStdLat="0.015"
    drone-dji:RtkStdHgt="0.025">
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

/**
 * Injeta metadados EXIF e XMP DJI no buffer da imagem JPEG de forma 100% segura para o cabeçalho JPEG
 */
export const injectDjiMetadata = (dataUrl, profileModel = "Mavic 3M") => {
  let exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };

  try {
    exifDict = piexif.load(dataUrl);
  } catch (e) {
    exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };
  }

  const { lat, lon, alt } = extractGpsCoords(exifDict);

  // 1. Injeta Make e Model nos metadados 0th IFD
  exifDict['0th'] = exifDict['0th'] || {};
  exifDict['0th'][piexif.ImageIFD.Make] = "DJI";
  exifDict['0th'][piexif.ImageIFD.Model] = profileModel;

  // 2. Garante que as tags EXIF GPS padrão estejam gravadas
  exifDict['GPS'] = exifDict['GPS'] || {};
  exifDict['GPS'][piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
  exifDict['GPS'][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
  exifDict['GPS'][piexif.GPSIFD.GPSLatitude] = degToDmsRational(lat);
  exifDict['GPS'][piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? 'E' : 'W';
  exifDict['GPS'][piexif.GPSIFD.GPSLongitude] = degToDmsRational(lon);
  exifDict['GPS'][piexif.GPSIFD.GPSAltitudeRef] = alt >= 0 ? 0 : 1;
  exifDict['GPS'][piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(alt) * 100), 100];

  // 3. Dump e insere o bloco EXIF usando piexif
  const exifBytes = piexif.dump(exifDict);
  const jpegWithExif = piexif.insert(exifBytes, dataUrl);

  // 4. Converte o JPEG em Uint8Array para inserção limpa do segmento APP1 XMP (Norma Adobe XMP)
  const base64Str = jpegWithExif.split(',')[1];
  const binaryString = atob(base64Str);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Prepara o bloco XMP
  const xmpXml = createDjiXmpXml(lat, lon, alt);
  const xmpHeaderBytes = new TextEncoder().encode(XMP_HEADER);
  const xmpXmlBytes = new TextEncoder().encode(xmpXml);

  // Tamanho do payload (comprimento de 2 bytes + header XMP + XML)
  const payloadLen = 2 + xmpHeaderBytes.length + xmpXmlBytes.length;
  const app1Segment = new Uint8Array(2 + payloadLen);
  
  app1Segment[0] = 0xFF;
  app1Segment[1] = 0xE1; // Marcador APP1
  app1Segment[2] = (payloadLen >> 8) & 0xFF;
  app1Segment[3] = payloadLen & 0xFF;
  app1Segment.set(xmpHeaderBytes, 4);
  app1Segment.set(xmpXmlBytes, 4 + xmpHeaderBytes.length);

  // Especificação Adobe XMP Part 3: O segmento APP1 XMP deve ser inserido logo após o marcador SOI (0xFFD8, posição 2)
  const insertPos = 2;

  const finalBytes = new Uint8Array(bytes.length + app1Segment.length);
  finalBytes.set(bytes.subarray(0, insertPos), 0);
  finalBytes.set(app1Segment, insertPos);
  finalBytes.set(bytes.subarray(insertPos), insertPos + app1Segment.length);

  // Converte de volta para Base64 usando TypedArray direto
  let binaryStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < finalBytes.length; i += chunkSize) {
    binaryStr += String.fromCharCode.apply(null, finalBytes.subarray(i, i + chunkSize));
  }

  return `data:image/jpeg;base64,${btoa(binaryStr)}`;
};
