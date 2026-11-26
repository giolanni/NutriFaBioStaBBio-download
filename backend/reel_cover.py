"""Extract a JPEG cover from an already downloaded Reel."""
import base64
import json
import math
from pathlib import Path
import subprocess
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


def _decode(command: list[str]) -> bytes:
    return subprocess.run(
        command, check=True, capture_output=True, timeout=4
    ).stdout


def _score(frame: bytes) -> float:
    if len(frame) != 64 * 64:
        return 0.0
    visible = sum(20 < pixel < 235 for pixel in frame) / len(frame)
    if visible < 0.35:
        return 0.0
    # Average local contrast in a tiny grayscale preview.
    contrast = sum(
        abs(frame[index] - frame[index - 1]) + abs(frame[index] - frame[index - 64])
        for index in range(65, len(frame)) if index % 64
    ) / len(frame)
    return visible * contrast


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def instagram_thumbnail_image(url: str | None) -> str | None:
    """Load a bounded public thumbnail from Instagram's media CDN."""
    if not url:
        return None
    try:
        parsed = urlsplit(url)
        host = parsed.hostname or ""
        if (parsed.scheme != "https" or parsed.netloc != host
                or not host.endswith((".cdninstagram.com", ".fbcdn.net"))):
            return None
        request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "image/*"})
        with build_opener(_NoRedirect()).open(request, timeout=5) as response:
            image = response.read(250_001)
        if not image.startswith(b"\xff\xd8\xff") or len(image) > 250_000:
            return None
        return "data:image/jpeg;base64," + base64.b64encode(image).decode("ascii")
    except (OSError, ValueError):
        return None


def reel_cover_image(video: Path, preferred_second: float | None = None) -> str | None:
    """Prefer a suggested moment, then look for a clear frame near the end."""
    try:
        metadata = json.loads(_decode([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "json", str(video),
        ]))
        duration = float(metadata["format"]["duration"])
        if not math.isfinite(duration) or duration <= 0:
            return None
        candidates = [(duration * fraction, bias) for fraction, bias in (
            (0.88, 1.3), (0.75, 1.2), (0.62, 1.1), (0.12, 1.0)
        )]
        if preferred_second is not None and 0 <= preferred_second < duration:
            candidates.insert(0, (preferred_second, 2.0))
        best_score = 0.0
        best_command = None
        for second, bias in candidates:
            command = [
                "ffmpeg", "-nostdin", "-v", "error", "-ss", f"{second:.3f}",
                "-i", str(video), "-map", "0:v:0", "-frames:v", "1",
            ]
            try:
                gray = _decode(command + [
                    "-vf", "scale=64:64,format=gray", "-threads", "1",
                    "-f", "rawvideo", "pipe:1",
                ])
            except (OSError, subprocess.SubprocessError):
                continue
            score = bias * _score(gray)
            if score > best_score:
                best_score, best_command = score, command
        if best_command is None:
            return None
        jpeg = _decode(best_command + [
            "-vf", "scale=640:640:force_original_aspect_ratio=decrease",
            "-threads", "1", "-q:v", "5", "-f", "mjpeg", "pipe:1",
        ])
        if not jpeg.startswith(b"\xff\xd8") or len(jpeg) > 250_000:
            return None
        return "data:image/jpeg;base64," + base64.b64encode(jpeg).decode("ascii")
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        return None
