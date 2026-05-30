import requests
import base64

api_key = "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"
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

# Convert test.png to base64
try:
    with open("test.png", "rb") as f:
        b64_image = base64.b64encode(f.read()).decode("utf-8")
except FileNotFoundError:
    b64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# Try base64: prefix
print("--- Testing base64: prefix ---")
payload = {
    "prompt": "make it red",
    "image": f"base64,{b64_image}"
}
response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)

# Try without comma
print("\n--- Testing base64 without comma ---")
payload = {
    "prompt": "make it red",
    "image": b64_image
}
response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)
