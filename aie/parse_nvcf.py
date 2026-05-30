import json

log_path = "/home/jacob/.gemini/antigravity-cli/brain/8f36c5f9-e8cf-43bd-8c6b-ea3ba9751e6e/.system_generated/tasks/task-253.log"
with open(log_path, "r") as f:
    lines = f.readlines()

json_text = ""
for line in lines:
    if line.startswith("{") or json_text:
        json_text += line

try:
    data = json.loads(json_text)
except Exception as e:
    print("Error parsing JSON:", e)
    # Print the beginning of the text to debug
    print(json_text[:200])
    exit(1)

functions = data.get("functions", [])
print(f"Total functions found: {len(functions)}")

terms = ["qwen", "edit", "image", "img", "diffusion", "flux", "stability", "wan"]
for f in functions:
    name = f.get("name", "").lower()
    if any(t in name for t in terms):
        print(f"Name: {f.get('name')}, ID: {f.get('id')}, Status: {f.get('status')}")
