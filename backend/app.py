import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field
from yt_dlp import YoutubeDL

app = FastAPI(title="NutriFaBioStaBBio API", version="1.0.0")

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

client = OpenAI()
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


def download_reel_audio(url: str, directory: Path) -> tuple[Path, str]:
    output = str(directory / "reel.%(ext)s")
    options = {
        "format": "bestaudio/best",
        "outtmpl": output,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries": 2,
        "max_filesize": 60 * 1024 * 1024,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "96",
            }
        ],
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as exc:
        raise HTTPException(
            422,
            "Non riesco a leggere questo Reel. Deve essere pubblico e accessibile senza login.",
        ) from exc

    audio = directory / "reel.mp3"
    if not audio.exists():
        matches = list(directory.glob("reel.*"))
        if not matches:
            raise HTTPException(422, "Il Reel non contiene un audio analizzabile.")
        audio = matches[0]
    caption = (info or {}).get("description") or (info or {}).get("title") or ""
    return audio, caption[:12000]


def transcribe(audio_path: Path) -> str:
    try:
        with audio_path.open("rb") as audio:
            result = client.audio.transcriptions.create(
                model=os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe"),
                file=audio,
                response_format="json",
            )
        return result.text
    except Exception as exc:
        raise HTTPException(502, "Trascrizione non riuscita. Riprova tra poco.") from exc


def build_recipe(transcript: str, caption: str) -> Recipe:
    prompt = f"""
Ricostruisci una ricetta italiana usando esclusivamente le informazioni presenti
nella didascalia e nella trascrizione di un video. Non inventare quantità, tempi,
calorie o passaggi non dichiarati: usa null o segnala il dubbio nelle note.
Normalizza ingredienti e procedimento in liste ordinate. confidence deve essere
'una tra alta, media, bassa'.

DIDASCALIA:
{caption or "(assente)"}

TRASCRIZIONE:
{transcript or "(nessun parlato riconosciuto)"}
"""
    try:
        response = client.responses.parse(
            model=os.getenv("OPENAI_RECIPE_MODEL", "gpt-5-mini"),
            input=[
                {
                    "role": "system",
                    "content": "Sei un assistente che estrae fedelmente ricette da contenuti social.",
                },
                {"role": "user", "content": prompt},
            ],
            text_format=Recipe,
        )
        if response.output_parsed is None:
            raise ValueError("Risposta strutturata assente")
        return response.output_parsed
    except Exception as exc:
        raise HTTPException(502, "Analisi della ricetta non riuscita. Riprova.") from exc


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=Recipe)
def analyze(payload: AnalyzeRequest, request: Request):
    url = validate_instagram_url(payload.url)
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "Il servizio non è ancora configurato con la chiave API.")
    with tempfile.TemporaryDirectory(prefix="nutrifabio-") as tmp:
        audio, caption = download_reel_audio(url, Path(tmp))
        transcript = transcribe(audio)
        return build_recipe(transcript, caption)
