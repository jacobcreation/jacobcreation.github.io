import requests
import base64

api_key = "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"
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

# Convert test.png to base64 (raw)
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

# Try raw base64
print("--- Testing raw base64 ---")
payload_raw = {
    "prompt": "make it red",
    "image": b64_image
}
response = requests.post(url, json=payload_raw, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)

# Try 'image_url' like OpenAI
print("\n--- Testing image_url format ---")
payload_url = {
    "prompt": "make it red",
    "image": {
        "url": f"data:image/png;base64,{b64_image}"
    }
}
response = requests.post(url, json=payload_url, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)

# Try 'content' array like chat completions
print("\n--- Testing chat completions format ---")
payload_chat = {
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "make it red"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_image}"}}
            ]
        }
    ]
}
response = requests.post(url, json=payload_chat, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)
