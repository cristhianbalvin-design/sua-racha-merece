import sys
import time
import numpy as np
import cv2
from insightface.app import FaceAnalysis

def main():
    if len(sys.argv) < 3:
        print("Usage: python test_insightface.py <path_reference_image> <path_action_image>")
        sys.exit(1)

    ref_path = sys.argv[1]
    action_path = sys.argv[2]

    # Initialize FaceAnalysis
    # This will download buffalo_l model if not present in ~/.insightface/models/
    print("Initializing InsightFace model (buffalo_l)...")
    start_init = time.time()
    app = FaceAnalysis(name='buffalo_l')
    app.prepare(ctx_id=0, det_size=(640, 640))
    print(f"Model initialized in {time.time() - start_init:.2f} seconds.")

    # Read images
    print("Reading images...")
    img_ref = cv2.imread(ref_path)
    img_act = cv2.imread(action_path)

    if img_ref is None:
        print(f"Error: Could not read reference image at {ref_path}")
        sys.exit(1)
    if img_act is None:
        print(f"Error: Could not read action image at {action_path}")
        sys.exit(1)

    # Detect faces
    print("Detecting faces in reference image...")
    start_det_ref = time.time()
    faces_ref = app.get(img_ref)
    print(f"Detection took {time.time() - start_det_ref:.2f} seconds. Found {len(faces_ref)} face(s).")
    
    if len(faces_ref) == 0:
        print("Error: No face detected in reference image.")
        sys.exit(1)
    
    # Use the largest face if multiple
    face_ref = max(faces_ref, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))

    print("Detecting faces in action image...")
    start_det_act = time.time()
    faces_act = app.get(img_act)
    print(f"Detection took {time.time() - start_det_act:.2f} seconds. Found {len(faces_act)} face(s).")

    if len(faces_act) == 0:
        print("Error: No face detected in action image.")
        sys.exit(1)

    # Use the largest face
    face_act = max(faces_act, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))

    # Calculate cosine similarity
    emb1 = face_ref.embedding
    emb2 = face_act.embedding

    # Cosine similarity formula: dot(a, b) / (norm(a) * norm(b))
    sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

    print(f"Cosine Similarity: {sim:.4f}")

if __name__ == '__main__':
    main()
