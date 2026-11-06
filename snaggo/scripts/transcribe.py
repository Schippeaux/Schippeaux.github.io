#!/usr/bin/env python3
"""
Snaggo — dictation transcription (PC-side, run manually after a site visit)

What this does:
  1. Unzips a Snaggo project export (the .zip you got from "Export project"
     in the app).
  2. For each dictation in audio/, sends it off for transcription, then asks
     the model to turn the rough spoken note into a professional defect
     note.
  3. Writes transcriptions.csv next to the unzipped project, with columns:
     defect_id, raw_transcript, polished_notes, suggested_title

You review/edit transcriptions.csv in Excel, then import it back into
Snaggo via "Import transcriptions (.csv)" on the project home screen —
it matches rows to defects by defect_id and appends the polished note to
that defect's Comments, tagged "[AI transcription — reviewed]".

STATUS: scaffold only. The actual API call is stubbed — see transcribe_clip()
below. Wire up Claude or Gemini once you've decided which; both need:
  - an API key (set via environment variable, see note in transcribe_clip)
  - the `anthropic` or `google-genai` Python package installed

Usage:
    python transcribe.py path/to/project_2026-11-06.zip
"""

import argparse
import csv
import json
import sys
import zipfile
from pathlib import Path

PROMPT_TEMPLATE = """You are helping an architect turn a rough spoken site note
into a professional defect-report entry. The transcript below was dictated
on-site and may be informal, trail off, or contain filler words.

Rewrite it as a concise, professional defect note (1-3 sentences). Keep all
factual detail (locations, materials, measurements, trades involved). Do not
invent anything that wasn't said. Do not include a heading or label, just the
note itself.

Transcript:
\"\"\"{transcript}\"\"\"
"""


def transcribe_clip(audio_path: Path) -> str:
    """Return a raw speech-to-text transcript for one audio file.

    TODO: wire up whichever provider you choose.

    Claude (Anthropic) does not currently take raw audio directly in the
    Messages API — you'd pair a speech-to-text step (e.g. a local Whisper
    model, or any STT service) with Claude for the "polish into a
    professional note" step below.

    Gemini can take audio natively, e.g. (google-genai):

        from google import genai
        client = genai.Client()  # reads GEMINI_API_KEY from env
        uploaded = client.files.upload(file=str(audio_path))
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=["Transcribe this audio exactly as spoken.", uploaded],
        )
        return resp.text
    """
    raise NotImplementedError(
        f"transcribe_clip() is a stub — wire up Claude/Gemini before running this on {audio_path.name}"
    )


def polish_transcript(raw_transcript: str) -> str:
    """Turn a raw transcript into a professional defect note.

    TODO: call Claude, e.g.:

        import anthropic
        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=300,
            messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(transcript=raw_transcript)}],
        )
        return msg.content[0].text.strip()
    """
    raise NotImplementedError("polish_transcript() is a stub — wire up Claude/Gemini before running")


def suggest_title(polished_notes: str) -> str:
    """Optional: a short title suggestion derived from the polished note.
    Cheap to do with the same model call as polish_transcript() — ask for
    both in one request if you want to save a round trip.
    """
    return polished_notes.split(".")[0][:60]


def main():
    parser = argparse.ArgumentParser(description="Transcribe Snaggo dictations into a review CSV.")
    parser.add_argument("export_zip", type=Path, help="Path to a Snaggo project export .zip")
    parser.add_argument("--out", type=Path, default=None, help="Output CSV path (default: alongside the zip)")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip audio clips whose manifest entry already has a transcriptPolished value",
    )
    args = parser.parse_args()

    if not args.export_zip.exists():
        sys.exit(f"Not found: {args.export_zip}")

    workdir = args.export_zip.with_suffix("")
    workdir.mkdir(exist_ok=True)
    with zipfile.ZipFile(args.export_zip) as zf:
        zf.extractall(workdir)

    manifest_path = workdir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    out_csv = args.out or (args.export_zip.parent / "transcriptions.csv")
    rows = []

    for entry in manifest.get("audio", []):
        if args.skip_existing and entry.get("transcriptPolished"):
            continue
        audio_path = workdir / entry["file"]
        print(f"Transcribing {audio_path.name} (defect {entry['defectId']})...")
        try:
            raw = transcribe_clip(audio_path)
            polished = polish_transcript(raw)
            title = suggest_title(polished)
        except NotImplementedError as e:
            print(f"  -> skipped: {e}")
            continue
        rows.append(
            {
                "defect_id": entry["defectId"],
                "raw_transcript": raw,
                "polished_notes": polished,
                "suggested_title": title,
            }
        )

    if not rows:
        print("\nNo transcripts produced (transcribe_clip / polish_transcript are still stubs).")
        print("Wire those two functions up to Claude or Gemini, then re-run.")
        return

    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["defect_id", "raw_transcript", "polished_notes", "suggested_title"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} row(s) to {out_csv}")
    print("Review/edit in Excel, then import via Snaggo's 'Import transcriptions (.csv)' button.")


if __name__ == "__main__":
    main()
