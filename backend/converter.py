import subprocess
import os
import shutil
from typing import List

# Perfis de Drones Suportados
PROFILES = {
    "mini3": {"Make": "DJI", "Model": "Mavic 3M", "RtkFlag": "1", "GimbalPitchDegree": "-90"},
    "neo": {"Make": "DJI", "Model": "Mavic 3M", "RtkFlag": "1", "GimbalPitchDegree": "-90"},
    "mavicpro": {"Make": "DJI", "Model": "Mavic 3M", "RtkFlag": "1", "GimbalPitchDegree": "-90"},
    "default": {"Make": "DJI", "Model": "Mavic 3M", "RtkFlag": "1"}
}

def convert_images(image_paths: List[str], profile_name: str, output_dir: str):
    profile = PROFILES.get(profile_name, PROFILES["default"])
    base_cmd = ["exiftool", "-overwrite_original", "-n"]
    for tag, value in profile.items():
        base_cmd.append(f"-{tag}={value}")
        
    results = []
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        out_path = os.path.join(output_dir, filename)
        shutil.copy2(img_path, out_path)
        cmd = base_cmd + [
            "-XMP-drone-dji:AbsoluteAltitude<GPSAltitude",
            "-XMP-drone-dji:RelativeAltitude<GPSAltitude", 
            "-XMP-drone-dji:GpsLatitude<GPSLatitude",
            "-XMP-drone-dji:GpsLongitude<GPSLongitude",
            "-XMP-drone-dji:GimbalPitchDegree=-90",
            "-XMP-drone-dji:RtkFlag=1",
            out_path
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            results.append({"filename": filename, "status": "success"})
        except Exception as e:
            results.append({"filename": filename, "status": "error", "message": f"Erro: Verifique se o ExifTool está instalado e no PATH da sua máquina. {str(e)}"})
    return results
