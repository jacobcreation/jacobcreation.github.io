import requests
import base64

api_key = "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"
# url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-kontext-dev"

# Convert test.png to base64 data URI
try:
    with open("test.png", "rb") as f:
        b64_image = base64.b64encode(f.read()).decode("utf-8")
    image_data_url = f"data:image/png;base64,{b64_image}"
except FileNotFoundError:
    image_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

payload = {
    "prompt": "make it red",
    "image": image_data_url
}

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print("URL:", url)
print("Status:", response.status_code)
print("Body:", response.text)

# Try with dot
url_dot = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
response_dot = requests.post(url_dot, json=payload, headers=headers)
print("\nURL (dot):", url_dot)
print("Status:", response_dot.status_code)
print("Body:", response_dot.text)
