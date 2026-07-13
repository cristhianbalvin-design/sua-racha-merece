import sys
import argparse
import requests
import numpy as np

def main():
    parser = argparse.ArgumentParser(description="Test Face Recognition API")
    parser.add_argument("path_ref", help="Path to reference image")
    parser.add_argument("path_act", help="Path to action image")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Base URL of the API")
    args = parser.parse_args()

    ref_path = args.path_ref
    act_path = args.path_act
    base_url = args.url.rstrip('/')

    # Test /embed endpoint for reference image
    with open(ref_path, "rb") as f:
        resp_embed = requests.post(f"{base_url}/embed", files={"file": f})
    
    if resp_embed.status_code != 200:
        print(f"Error calling /embed: {resp_embed.text}")
        sys.exit(1)
        
    emb1 = np.array(resp_embed.json()["embedding"])

    # Test /compare endpoint for action image
    with open(act_path, "rb") as f:
        resp_compare = requests.post(f"{base_url}/compare", files={"file": f})

    if resp_compare.status_code != 200:
        print(f"Error calling /compare: {resp_compare.text}")
        sys.exit(1)

    emb2 = np.array(resp_compare.json()["embedding"])

    # Calculate similarity
    sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

    print(f"API Cosine Similarity: {sim:.4f}")

if __name__ == "__main__":
    main()
