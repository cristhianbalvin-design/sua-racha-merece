from insightface.app import FaceAnalysis

print("Downloading and extracting buffalo_l model...")
app = FaceAnalysis(name='buffalo_l')
# prepare triggers the download if not present
app.prepare(ctx_id=0, det_size=(640, 640))
print("Download complete.")
