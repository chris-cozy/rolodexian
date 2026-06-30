# Rolodexian

Rolodexian is a local-first personal network app for managing contact profiles, relationship details, interaction history, images, and a self-centered relationship graph.

## Features

- Create, view, edit, search, and delete contacts.
- Store aliases, social accounts, birthdates, appearance notes, traits, preferences, summaries, custom fields, and interaction events.
- Track each contact's relationship to you, relationship strength, notes, important dates, and last interaction date.
- Create and edit relationships between contacts.
- Upload profile images and additional related images.
- View an interactive graph with you at the center, contacts around you, and contact-to-contact relationship edges.
- Persist SQLite data and uploaded images through Docker volumes.

## Run With Docker

Requirements:

- Docker
- Docker Compose

Start the app:

```bash
docker compose up --build
```

Open:

```text
http://localhost:4000
```

Data persists in the `rolodexian-data` Docker volume. The SQLite database and uploads are stored under `/app/data` inside the container.

Stop the app:

```bash
docker compose down
```

Remove persisted app data:

```bash
docker compose down -v
```

## Local Development

Requirements:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm install
```

Start the API and Vite dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The dev server proxies `/api` and `/uploads` to the Express API on port `4000`.

## Demo Data

With the app running, seed temporary demo contacts, images, interactions, and relationships:

```bash
npm run seed
```

Clear only the demo records created by the seed script:

```bash
npm run seed:clear
```

## Production Build

Build the frontend:

```bash
npm run build
```

Run the production server:

```bash
npm start
```

The Express server serves both the API and the built React app.

## Environment Variables

See `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port for the Express server |
| `DATA_DIR` | `./data` locally, `/app/data` in Docker | Persistent app data directory |
| `UPLOAD_DIR` | `${DATA_DIR}/uploads` | Uploaded image storage |
| `DATABASE_PATH` | `${DATA_DIR}/rolodexian.sqlite` | SQLite database file |

## Data Model

Rolodexian uses SQLite with these main tables:

- `contacts`
- `social_accounts`
- `interaction_events`
- `images`
- `relationships`

Flexible fields such as nicknames, appearance, traits, preferences, important dates, and custom fields are stored as JSON so new attributes can be added later without reshaping the whole app.

## Privacy

Rolodexian runs locally by default. Contact data and uploaded images stay on the host running the app unless you intentionally move the database, uploads, or Docker volume somewhere else.
