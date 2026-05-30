import requests

api_key = "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"
models = [
    "black-forest-labs/flux.1-schnell",
    "black-forest-labs/flux-1-schnell",
    "stabilityai/sdxl-turbo",
    "stabilityai/stable-diffusion-xl-turbo",
    "nvidia/qwen-image-edit",
    "qwen/qwen-image-edit",
]

for m in models:
    url = f"https://ai.api.nvidia.com/v1/genai/{m}"
    try:
        response = requests.post(url, headers={"Authorization": f"Bearer {api_key}"})
        print(f"{m} -> Status: {response.status_code}")
    except Exception as e:
        print(f"{m} -> Error: {e}")
