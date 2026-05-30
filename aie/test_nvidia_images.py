import requests
import base64

api_key = "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"
url = "https://ai.api.nvidia.com/v1/images/edits"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
}

# Small 1x1 white pixel
b64_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

payload = {
    "model": "black-forest-labs/flux.1-kontext-dev",
    "prompt": "make it red",
    "image": f"data:image/png;base64,{b64_img}",
}

print(f"--- Testing /v1/images/edits with {payload['model']} ---")
try:
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
