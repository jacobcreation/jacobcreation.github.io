import requests
import base64

api_key = "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"
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
}

# Small 1x1 white pixel
b64_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
img_data = base64.b64decode(b64_img)

files = {
    "image": ("test.png", img_data, "image/png"),
}
data = {
    "prompt": "make it red",
}

print(f"--- Testing {url} with multipart/form-data ---")
try:
    response = requests.post(url, headers=headers, files=files, data=data)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
