import requests
import base64

api_key = "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"
url = "https://integrate.api.nvidia.com/v1/images/edits"

# Convert test.png to base64
try:
    with open("test.png", "rb") as f:
        b64_image = base64.b64encode(f.read()).decode("utf-8")
except FileNotFoundError:
    b64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

payload = {
    "model": "black-forest-labs/flux.1-kontext-dev",
    "prompt": "make it red",
    "image": f"data:image/png;base64,{b64_image}"
}

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json"
}

# Note: /v1/images/edits often expects multipart/form-data or a specific JSON format
print("--- Testing /v1/images/edits ---")
response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)
