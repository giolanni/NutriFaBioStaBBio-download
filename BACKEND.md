# Backend Instagram di NutriFaBioStaBBio

Il servizio riceve il link di un Reel pubblico, estrae l'audio con yt-dlp,
lo trascrive e restituisce una ricetta strutturata e modificabile.

## Pubblicazione su Render

1. Aprire il Blueprint Render del repository.
2. Collegare GitHub e scegliere il piano Free.
3. Inserire `OPENAI_API_KEY` tra i secret del servizio.
4. Attendere il deploy e verificare `/health`.

Il piano gratuito di Render può impiegare circa un minuto a riattivarsi dopo
15 minuti di inattività. La chiave API non deve essere inserita in GitHub o
nel codice della pagina.

## Test locale

```bash
cd backend
docker build -t nutrifabio-api .
docker run --rm -p 10000:10000 -e OPENAI_API_KEY=... nutrifabio-api
```

```bash
curl -X POST http://localhost:10000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/reel/..." }'
```
