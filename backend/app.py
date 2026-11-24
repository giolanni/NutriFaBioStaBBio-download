import os
import re
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from yt_dlp import YoutubeDL

app = FastAPI(title="NutriFaBioStaBBio API", version="1.1.0")

origins = [
    item.strip()
    for item in os.getenv(
        "ALLOWED_ORIGINS",
        "https://giolanni.github.io,http://localhost:8000",
    ).split(",")
    if item.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

INSTAGRAM_PATH = re.compile(r"^/(reel|reels|p)/[A-Za-z0-9_-]+/?", re.I)


class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=20, max_length=500)


class Recipe(BaseModel):
    title: str
    category: str
    time_minutes: int | None
    servings: int | None
    ingredients: list[str]
    steps: list[str]
    calories_per_serving: int | None
    notes: list[str]
    confidence: str


def validate_instagram_url(value: str) -> str:
    parsed = urlparse(value.strip())
    host = parsed.netloc.lower().split(":")[0]
    if parsed.scheme != "https" or host not in {"instagram.com", "www.instagram.com"}:
        raise HTTPException(400, "Inserisci un link HTTPS di Instagram.")
    if not INSTAGRAM_PATH.match(parsed.path):
        raise HTTPException(400, "Il link deve riferirsi a un Reel o a un post Instagram.")
    return value.strip()


def download_reel(url: str, directory: Path) -> Path:
    output = str(directory / "reel.%(ext)s")
    options = {
        "format": "best[height<=720]/best",
        "outtmpl": output,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries": 2,
        "max_filesize": 80 * 1024 * 1024,
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            path = Path(ydl.prepare_filename(info))
    except Exception as exc:
        raise HTTPException(
            422,
            "Non riesco a leggere questo Reel. Deve essere pubblico e accessibile senza login.",
        ) from exc

    candidates = [path, directory / "reel.mp4", *directory.glob("reel.*")]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    raise HTTPException(422, "Il Reel non contiene un video analizzabile.")


def analyze_video(video_path: Path) -> Recipe:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(503, "Il servizio gratuito non è ancora configurato.")

    client = genai.Client(api_key=api_key)
    uploaded = None
    try:
        uploaded = client.files.upload(file=str(video_path))
        deadline = time.monotonic() + 180
        while not uploaded.state or uploaded.state.name != "ACTIVE":
            if uploaded.state and uploaded.state.name == "FAILED":
                raise RuntimeError("Elaborazione video fallita")
            if time.monotonic() > deadline:
                raise TimeoutError("Elaborazione video scaduta")
            time.sleep(3)
            uploaded = client.files.get(name=uploaded.name)

        prompt = """
Analizza attentamente immagini, scritte in sovrimpressione e audio di questo
video di cucina. Ricostruisci la ricetta in italiano. Non inventare quantità,
tempi, calorie o passaggi non presenti: usa null per i numeri mancanti e indica
i dubbi nelle note. Ingredienti e procedimento devono essere liste ordinate.
confidence deve essere una tra: alta, media, bassa.
"""
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=[uploaded, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=Recipe,
            ),
        )
        return Recipe.model_validate_json(response.text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            502,
            "L’analisi gratuita non è riuscita. Attendi qualche minuto e riprova.",
        ) from exc
    finally:
        if uploaded and uploaded.name:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass


@app.get("/health")
def health():
    return {"status": "ok", "engine": "gemini-free"}


@app.post("/analyze", response_model=Recipe)
def analyze(payload: AnalyzeRequest):
    url = validate_instagram_url(payload.url)
    with tempfile.TemporaryDirectory(prefix="nutrifabio-") as tmp:
        video = download_reel(url, Path(tmp))
        return analyze_video(video)
