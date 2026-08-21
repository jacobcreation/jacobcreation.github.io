import json
import socket
from pathlib import Path


def main():
    files = [str(path) for path in Path("/kaggle/input").rglob("*")][:300]
    dns = {}
    for host in ("github.com", "pypi.org", "huggingface.co"):
        try:
            dns[host] = socket.gethostbyname(host)
        except Exception as error:
            dns[host] = f"{type(error).__name__}: {error}"
    result = {
        "input_exists": Path("/kaggle/input").exists(),
        "input_files": files,
        "dns": dns,
    }
    print(json.dumps(result, indent=2), flush=True)
    Path("/kaggle/working/kaggle-smoke-result.json").write_text(
        json.dumps(result, indent=2)
    )


if __name__ == "__main__":
    main()
