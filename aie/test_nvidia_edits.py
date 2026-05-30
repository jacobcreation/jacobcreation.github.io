import requests
import base64

api_key = "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"
url = "https://integrate.api.nvidia.com/v1/chat/completions"

# Convert test.png to base64 data URI
with open("test.png", "rb") as f:
    b64_image = base64.b64encode(f.read()).decode("utf-8")
image_data_url = f"data:image/png;base64,{b64_image}"

payload = {
    "model": "qwen-image-edit",
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "make the image red"},
                {"type": "image_url", "image_url": {"url": image_data_url}}
            ]
        }
    ]
}

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Body:", response.text)
