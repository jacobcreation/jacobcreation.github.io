import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
from pathlib import Path


WORKING = Path("/kaggle/working")
INPUT = Path("/kaggle/input")
REQUEST_PATH = Path(__file__).with_name("request.json")
ACE_DIR = WORKING / "ACE-Step-1.5"
OUT_DIR = WORKING / "song-maker-output"
RESULT_PATH = WORKING / "result.json"


def run(cmd, cwd=None):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def read_request():
    if REQUEST_PATH.exists():
        return json.loads(REQUEST_PATH.read_text())
    for path in INPUT.rglob("request.json"):
        return json.loads(path.read_text())
    return {}


def find_audio_file(root):
    candidates = []
    for suffix in ("*.mp3", "*.wav", "*.flac"):
        candidates.extend(root.rglob(suffix))
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def prepare_ace_source():
    print("Kaggle input files:", flush=True)
    for path in sorted(INPUT.rglob("*"))[:200]:
        print(f"  {path}", flush=True)

    archive = next(INPUT.rglob("ace-step-src.tar.gz"), None)
    if archive:
        ACE_DIR.mkdir(parents=True, exist_ok=True)
        with tarfile.open(archive, "r:gz") as extracted:
            extracted.extractall(ACE_DIR)
        return

    app_py = next(
        (
            path
            for path in INPUT.rglob("app.py")
            if (path.parent / "requirements.txt").exists()
            and (path.parent / "acestep").exists()
        ),
        None,
    )
    if app_py:
        shutil.copytree(app_py.parent, ACE_DIR, dirs_exist_ok=True)
        return

    raise FileNotFoundError("Could not find ACE-Step source under /kaggle/input.")


def main():
    started = time.time()
    request = read_request()
    prompt = request.get("prompt") or "short upbeat pop, clean vocals"
    lyrics = request.get("lyrics") or ""
    instrumental = bool(request.get("instrumental", False))
    duration = int(request.get("duration", 10))
    inference_steps = int(request.get("inference_steps", 4))
    output_format = request.get("output_format") or "mp3"

    if not ACE_DIR.exists():
        prepare_ace_source()

    run([sys.executable, "-m", "pip", "install", "-U", "pip"])
    run([sys.executable, "-m", "pip", "install", "uv"])
    run(["uv", "sync"], cwd=ACE_DIR)

    inference_code = f"""
import json
from pathlib import Path
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

out_dir = Path({str(OUT_DIR)!r})
out_dir.mkdir(parents=True, exist_ok=True)

dit_handler = AceStepHandler()
dit_handler.initialize_service(
    project_root={str(ACE_DIR)!r},
    config_path="acestep-v15-turbo",
    device="cuda",
)

llm_handler = LLMHandler()
llm_handler.initialize(
    checkpoint_dir={str(ACE_DIR / "checkpoints")!r},
    lm_model_path="acestep-5Hz-lm-0.6B",
    backend="vllm",
    device="cuda",
)

params = GenerationParams(
    caption={prompt!r},
    lyrics={lyrics!r},
    instrumental={instrumental!r},
    duration={duration!r},
    inference_steps={inference_steps!r},
    vocal_language="en",
    thinking=False,
    use_cot_metas=False,
    use_cot_caption=False,
    use_cot_lyrics=False,
    use_cot_language=False,
)
config = GenerationConfig(batch_size=1, audio_format={output_format!r})
result = generate_music(dit_handler, llm_handler, params, config, save_dir=str(out_dir))
print(json.dumps(result.__dict__, default=str))
if not result.success:
    raise SystemExit(result.error or "ACE-Step generation failed")
"""
    runner = WORKING / "run_inference_inner.py"
    runner.write_text(inference_code)
    run(["uv", "run", str(runner)], cwd=ACE_DIR)

    audio = find_audio_file(OUT_DIR)
    if not audio:
        raise SystemExit("ACE-Step finished but no audio file was found.")
    final_audio = WORKING / f"song-maker-ace-step.{output_format}"
    shutil.copy2(audio, final_audio)
    RESULT_PATH.write_text(
        json.dumps(
            {
                "ok": True,
                "audio": str(final_audio),
                "source_audio": str(audio),
                "seconds": round(time.time() - started, 3),
                "prompt": prompt,
                "duration": duration,
                "inference_steps": inference_steps,
            },
            indent=2,
        )
    )
    print(RESULT_PATH.read_text(), flush=True)


if __name__ == "__main__":
    main()
