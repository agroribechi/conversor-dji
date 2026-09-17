import subprocess
import os
import shutil
import uuid
from typing import List

# Perfis de Drones Suportados
PROFILES = {
    "mini3": {
        "Make": "DJI",
        "Model": "Mavic 3M",
        "RtkFlag": "1",
        "GimbalPitchDegree": "-90"
    },
    "neo": {
        "Make": "DJI",
        "Model": "Mavic 3M",
        "RtkFlag": "1",
        "GimbalPitchDegree": "-90"
    },
    "mavicpro": {
        "Make": "DJI",
        "Model": "Mavic 3M",
        "RtkFlag": "1",
        "GimbalPitchDegree": "-90"
    },
    "default": {
        "Make": "DJI",
        "Model": "Mavic 3M",
        "RtkFlag": "1"
    }
}

def convert_images(image_paths: List[str], profile_name: str, output_dir: str):
    """
    Converte uma lista de imagens para o formato DJI Smart Farm.
    """
    profile = PROFILES.get(profile_name, PROFILES["default"])
    
    # Montar comando base do ExifTool
    # -overwrite_original: Não cria backup _original automaticamente pelo exiftool
    # -n: Força formato numérico
    base_cmd = ["exiftool", "-overwrite_original"]
    
    # Adicionar tags do perfil
    for tag, value in profile.items():
        base_cmd.append(f"-{tag}={value}")
        
    # Tags de fotogrametria que o Smart Farm exige (Mapeamento Genérico)
    # Se a foto já tiver RelativeAltitude, o exiftool vai manter se não mudarmos.
    # Mas o Smart Farm gosta do namespace XMP-drone-dji.
    
    results = []
    
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        out_path = os.path.join(output_dir, filename)
        
        # Copiar para a pasta de saída antes de modificar
        shutil.copy2(img_path, out_path)
        
        # Comando para injetar as tags XMP baseadas nas EXIF originais
        # Exemplo: Copiar GPSAltitude para AbsoluteAltitude do XMP DJI
        cmd = base_cmd + [
            "-XMP-drone-dji:AbsoluteAltitude<GPSAltitude",
            "-XMP-drone-dji:RelativeAltitude<GPSAltitude", # Fallback se não tiver relativo
            "-XMP-drone-dji:GimbalPitchDegree=-90",
            "-XMP-drone-dji:RtkFlag=1",
            out_path
        ]
        
        try:
            # Tentar rodar o comando
            subprocess.run(cmd, check=True, capture_output=True)
            results.append({"filename": filename, "status": "success"})
        except Exception as e:
            results.append({"filename": filename, "status": "error", "message": str(e)})
            
    return results
