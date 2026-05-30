import requests
import base64

api_key = "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"
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# Small 1x1 white pixel
b64_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

formats = [
    f"data:image/png;base64,{b64_img}",
    f"base64,{b64_img}",
    b64_img,
    "data:image/png;example_id,0",
]

for fmt in formats:
    print(f"\n--- Testing format: {fmt[:50]}... ---")
    payload = {
        "prompt": "make it red",
        "image": fmt,
    }
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
