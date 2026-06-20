import sys
import requests
import numpy as np

def main():
    if len(sys.argv) < 3:
        print("Usage: python test_api.py <path_ref> <path_act>")
        sys.exit(1)

    ref_path = sys.argv[1]
    act_path = sys.argv[2]

    # Test /embed endpoint for reference image
    with open(ref_path, "rb") as f:
        resp_embed = requests.post("http://127.0.0.1:8000/embed", files={"file": f})
    
    if resp_embed.status_code != 200:
        print(f"Error calling /embed: {resp_embed.text}")
        sys.exit(1)
        
    emb1 = np.array(resp_embed.json()["embedding"])

    # Test /compare endpoint for action image
    with open(act_path, "rb") as f:
        resp_compare = requests.post("http://127.0.0.1:8000/compare", files={"file": f})

    if resp_compare.status_code != 200:
        print(f"Error calling /compare: {resp_compare.text}")
        sys.exit(1)

    emb2 = np.array(resp_compare.json()["embedding"])

    # Calculate similarity
    sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

    print(f"API Cosine Similarity: {sim:.4f}")

if __name__ == "__main__":
    main()
