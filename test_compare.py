import os
import requests

url = "https://sua-racha-merece-production.up.railway.app/compare"
secret = os.environ.get("SERVICE_SECRET", "3buk-secret-key-2024")

with open("face-recognition-service/test_insightface.py", "rb") as f:
    files = {"file": ("dummy.jpg", f, "image/jpeg")}
    headers = {"X-Service-Secret": secret}
    try:
        response = requests.post(url, files=files, headers=headers, timeout=60)
        print("Status:", response.status_code)
        print("Response:", response.text[:200])
    except Exception as e:
        print("Error:", str(e))
