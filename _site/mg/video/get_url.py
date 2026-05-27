from huggingface_hub import InferenceClient
from unittest.mock import patch
import httpx

client = InferenceClient(model="tencent/HunyuanVideo", provider="fal-ai", token="hf_dummy")

def mock_request(method, url, **kwargs):
    print(f"Intercepted {method} request to: {url}")
    # If it's the model info check
    if "api/models/" in url:
        return httpx.Response(200, json={"modelId": "tencent/HunyuanVideo", "pipeline_tag": "text-to-video"}, request=httpx.Request(method, url))
    # Otherwise return a dummy response
    return httpx.Response(200, content=b"dummy_video_content", request=httpx.Request(method, url))

with patch("httpx.Client.request", side_effect=mock_request) as mock_post:
    try:
        client.text_to_video("a cat running")
    except Exception as e:
        print(f"Error: {e}")
