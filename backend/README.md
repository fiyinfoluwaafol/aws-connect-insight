# Backend Deploy Notes

## Railway

This backend is ready to deploy as its own Railway service from the
`backend/` directory.

- Root directory: `backend`
- Build command: `pip install -e .`
- Start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT --forwarded-allow-ips '*'`
- Health check path: `/health`

If you use Railway config-as-code, the backend service config lives in
`backend/railway.toml`.

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_ORIGIN`
- `ENVIRONMENT`

`OPENAI_API_KEY` is optional unless you want transcript analysis and other
OpenAI-backed flows enabled.

## Optional Twilio Variables

These are only needed for real call-ingestion flows under `/api/twilio/*`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_DEMO_AGENT_EMAIL`
