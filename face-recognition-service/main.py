from fastapi import FastAPI, UploadFile, File, HTTPException
import numpy as np
import cv2
from insightface.app import FaceAnalysis

app = FastAPI(title="Face Recognition Service")

# Initialize the model globally so it only loads once at startup
print("Initializing FaceAnalysis model...")
face_app = FaceAnalysis(name='buffalo_l')
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("Model ready.")

def get_face_embedding(image_bytes: bytes) -> list[float]:
    """Helper to detect the largest face and return its embedding."""
    # Decode image from memory
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    faces = face_app.get(img)
    if not faces:
        raise HTTPException(status_code=400, detail="No face detected in image")
        
    # Pick the largest face in case there are multiple people
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    
    # Return embedding as a standard python list of floats
    return face.embedding.tolist()

@app.post("/embed")
async def embed_face(file: UploadFile = File(...)):
    """
    Receives an image, returns its facial embedding.
    Used for the event photos upload flow (admin).
    """
    contents = await file.read()
    embedding = get_face_embedding(contents)
    return {"embedding": embedding}

@app.post("/compare")
async def compare_face(file: UploadFile = File(...)):
    """
    Receives an image, generates its embedding in memory, and returns it.
    The file is discarded immediately after processing.
    """
    contents = await file.read()
    embedding = get_face_embedding(contents)
    # At the end of this block, `contents`, `img`, and `faces` will be garbage collected.
    # Nothing is persisted to disk or databases.
    return {"embedding": embedding}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
