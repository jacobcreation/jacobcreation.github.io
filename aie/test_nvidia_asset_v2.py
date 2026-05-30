import requests

api_key = "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"
assets_url = "https://api.nvcf.nvidia.com/v2/nvcf/assets"

def upload_asset(file_path):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "accept": "application/json",
    }
    
    # 1. Authorize
    payload = {
        "contentType": "image/png",
        "description": "Test asset"
    }
    
    print("Requesting signed URL...")
    response = requests.post(assets_url, headers=headers, json=payload)
    if response.status_code != 200:
        print(f"Error authorizing: {response.status_code} {response.text}")
        return None
    
    data = response.json()
    upload_url = data["uploadUrl"]
    asset_id = data["assetId"]
    
    # 2. Upload
    print(f"Uploading to {upload_url}...")
    # The signed URL requires specific headers
    # Extract headers from the URL if possible, or use what was requested
    put_headers = {
        "Content-Type": "image/png",
        "x-amz-meta-nvcf-asset-description": "Test asset"
    }
    
    with open(file_path, "rb") as f:
        # Note: Do not let requests add any extra headers
        upload_response = requests.put(
            upload_url,
            data=f,
            headers=put_headers
        )
        if upload_response.status_code != 200:
            print(f"Error uploading: {upload_response.status_code} {upload_response.text}")
            return None
    
    print(f"Upload successful! Asset ID: {asset_id}")
    return asset_id

asset_id = upload_asset("test.png")
if asset_id:
    # 3. Test with flux.1-kontext-dev
    url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    
    # Reference the asset
    payload = {
        "prompt": "make it red",
        "image": f"data:image/png;asset_id,{asset_id}",
    }
    
    print(f"\nTesting {url} with asset_id...")
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")

    # Also try just the asset_id as a string
    print(f"\nTesting {url} with raw asset_id...")
    payload["image"] = asset_id
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
