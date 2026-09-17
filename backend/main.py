import os
import shutil
import uuid
import zipfile
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List
from converter import convert_images, PROFILES

app = FastAPI(title="DJI Converter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_processing"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/profiles")
def get_profiles():
    return {"profiles": list(PROFILES.keys())}

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...), profile: str = "default"):
    session_id = str(uuid.uuid4())
    session_path = os.path.join(TEMP_DIR, session_id)
    input_path = os.path.join(session_path, "input")
    output_path = os.path.join(session_path, "output")
    os.makedirs(input_path, exist_ok=True)
    os.makedirs(output_path, exist_ok=True)
    
    saved_paths = []
    for file in files:
        file_path = os.path.join(input_path, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_paths.append(file_path)
    
    results = convert_images(saved_paths, profile, output_path)
    zip_path = os.path.join(TEMP_DIR, f"{session_id}_converted.zip")
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for root, dirs, files_in_dir in os.walk(output_path):
            for f in files_in_dir:
                zipf.write(os.path.join(root, f), f)
                
    return {"session_id": session_id, "results": results, "download_url": f"/download/{session_id}"}

@app.get("/download/{session_id}")
async def download_zip(session_id: str):
    zip_path = os.path.join(TEMP_DIR, f"{session_id}_converted.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Session not found")
    return FileResponse(zip_path, media_type='application/zip', filename=f"dji_converted_{session_id[:8]}.zip")
