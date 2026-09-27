"""One-shot CPU IndicCOMET evaluation. Invoked only by the local API."""
import json
import os
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"


def main():
    from comet import load_from_checkpoint

    request = json.load(sys.stdin)
    model = load_from_checkpoint(request["checkpoint"], local_files_only=True)
    sample = [{"src": request["source"], "mt": request["translation"],
               "ref": request["reference"]}]
    prediction = model.predict(sample, batch_size=1, gpus=0,
                               accelerator="cpu", progress_bar=False)
    print(json.dumps({"score": float(prediction["scores"][0])}), flush=True)


if __name__ == "__main__":
    main()
