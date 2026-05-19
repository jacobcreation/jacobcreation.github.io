import requests

url = "https://integrate.api.nvidia.com/v1/models"
headers = {
    "Authorization": "Bearer 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"
}
response = requests.get(url, headers=headers)
models = response.json().get('data', [])
for m in models:
    if 'image' in m['id'].lower() or 'flux' in m['id'].lower() or 'diffusion' in m['id'].lower():
        print(m['id'])
