import requests

api_key = "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"

candidates = [
    "qwen/qwen-image-edit",
    "qwen/qwen-image-edit-2511",
    "qwen/qwen-image-edit-2509",
    "alibaba/qwen-image-edit",
    "alibaba/qwen-image-edit-2511",
    "alibaba/qwen-image-edit-2509",
    "nvidia/qwen-image-edit",
    "nvidia/qwen-image-edit-2511",
    "nvidia/qwen-image-edit-2509",
    "alibaba-cloud/qwen-image-edit",
    "alibabacloud/qwen-image-edit",
    "qwen/qwen-image",
    "qwen/qwen-image-generation",
]

for c in candidates:
    url = f"https://ai.api.nvidia.com/v1/genai/{c}"
    try:
        response = requests.post(url, headers={"Authorization": f"Bearer {api_key}"})
        print(f"{c} -> Status: {response.status_code}")
        if response.status_code != 404:
            print("FOUND!", url, response.text[:200])
    except Exception as e:
        print(f"{c} -> Error: {e}")
