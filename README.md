# Schoolwork tracker

## Run locally

Install dependencies, then start the API and frontend together:

```sh
npm install
npm run dev
```

This starts the API and Vite frontend together. Open the URL printed by Vite. The frontend proxies `/api` to the API on port `3001`. The API creates `server/data/schoolwork.sqlite` on first start; that file is ignored by Git and stores account credentials, sessions, and each user's schoolwork JSON. You can also run just the API with `npm run server`.

Create an account from the sign-in screen. Passwords must be at least 10 characters. Passwords are stored as per-account scrypt hashes; browser sessions use HTTP-only cookies. The app loads the signed-in user's data at login and saves changes to that user's server record automatically. The existing JSON file open/save actions remain available for importing and exporting.

Set `PORT` to change the API port; the Vite proxy uses the same value. Set `DATABASE_PATH` to store the SQLite database somewhere else. For deployment, serve the frontend and API behind the same origin (or configure a trusted same-origin reverse proxy); the API intentionally does not enable cross-origin credential requests.

## API

- `POST /api/auth/register` — create an account and start a session.
- `POST /api/auth/login` — authenticate and start a session.
- `POST /api/auth/logout` — revoke the current session.
- `GET /api/auth/me` — return the current user, or `null`.
- `GET /api/data` — retrieve the current user's saved JSON data.
- `PUT /api/data` — validate and save the current user's JSON data.
- `GET /api/health` — server health check.
