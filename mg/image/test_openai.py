from openai import OpenAI
import traceback

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)
try:
    response = client.images.generate(
        model="black-forest-labs/flux-1-schnell",
        prompt="A cute cat",
        response_format="b64_json"
    )
    print("Success")
except Exception as e:
    print("Error:")
    traceback.print_exc()
