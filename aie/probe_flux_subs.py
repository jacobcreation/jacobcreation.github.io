import requests

api_key = "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"
base_url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

sub_endpoints = [
    "/v1/image-to-image",
    "/v1/text-to-image",
    "/image-to-image",
    "/text-to-image",
]

for sub in sub_endpoints:
    url = base_url + sub
    try:
        response = requests.post(url, headers={"Authorization": f"Bearer {api_key}"})
        print(f"{url} -> Status: {response.status_code}")
    except Exception as e:
        print(f"{url} -> Error: {e}")
