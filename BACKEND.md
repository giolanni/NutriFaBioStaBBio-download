# Backend Instagram di NutriFaBioStaBBio

Il servizio riceve il link di un Reel pubblico, scarica temporaneamente il video
e usa il livello gratuito di Gemini per restituire una ricetta strutturata.

## Costi

La configurazione prevista non richiede carta di credito:

- Render: piano Free;
- Gemini API: Free Tier;
- nessuna chiave OpenAI.

Il Free Tier di Gemini ha limiti di utilizzo e i contenuti inviati possono essere
usati da Google per migliorare i prodotti. Usare quindi soltanto Reel pubblici.

## Pubblicazione

1. Collegare il repository GitHub a Render.
2. Pubblicare il Blueprint presente in `render.yaml` scegliendo il piano Free.
3. Creare gratuitamente una chiave in Google AI Studio, senza attivare Billing.
4. Inserirla su Render come secret `GEMINI_API_KEY`.
5. Verificare l'indirizzo `/health`.

La chiave non deve essere inserita nel repository, nell'APK o nella pagina web.
