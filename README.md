# Printing services — Order site

Simple Express-based order site for printing services. This creates short, shareable order pages.

How it works
- Visit the form at http://localhost:3000/
- Fill in name, email and details. Optionally attach a file (PDF/image).
- After submit you'll get a short URL like http://localhost:3000/o/ABC123 — just type that in the browser anytime to view the order.
- Admin listing (no auth) is at http://localhost:3000/admin.html

Run locally (Windows PowerShell):

```powershell
cd "C:\Users\Administrator\Desktop\Markus\Bhardz website"
npm install
npm start
```

Notes & next steps
- This is a minimal demo. For production you should add authentication for the admin, use a real database (SQLite/Postgres), validate/sanitize inputs, and secure uploads.

Deploying online

Options (pick one) and quick steps:

- Render (recommended, easy):
	1. Create a GitHub repository and push this project.
	2. Create a Render Web Service, connect your GitHub repo, choose the root directory, and use the `Dockerfile` (we included one) or the Build Command `npm install && npm run build` (no build step here).
	3. Set the service port to 3000 (Render sets PORT automatically via env var).

- Railway / Fly / Railway.app:
	1. Create an account and connect your GitHub repo.
	2. Railway will detect a Node app. Deploy and set any environment variables you need.

- Docker + any host (DigitalOcean, AWS ECS, Azure Container Instances):
	1. Build image locally: `docker build -t yourname/printing-orders .`
	2. Push to Docker Hub: `docker push yourname/printing-orders`
	3. Use your provider to run the container and map external port 80/443 to container port 3000.

- Heroku (note: Heroku free-tier changes):
	1. Create a Heroku app and connect repo, or push via Heroku CLI. The included `Procfile` will make it run.

Environment & secrets
- If you deploy publicly, consider adding an admin password or OAuth before exposing `/api/orders` and `/admin.html`.

If you tell me which host you'd like, I can:
- prepare a ready-to-use GitHub Actions workflow to build & push a Docker image (Docker Hub or GitHub Packages), or
- add basic HTTP auth to the admin endpoints, or
- replace file-based storage with SQLite and a small migration so data persists across container restarts.

What's already included (surprise bundle)
- SQLite persistence: orders are stored in `data/orders.db` so your data survives container restarts.
- Admin session login: Visit `/admin-login` and sign in with `ADMIN_USER`/`ADMIN_PASS` (defaults shown in `.env.example`). After login you'll access `/admin.html` which provides search and CSV export.
- GitHub Actions workflow: `.github/workflows/docker-publish.yml` builds and publishes a Docker image to GitHub Container Registry (GHCR) when you push to `main`.

Run notes (local)
- Install Node.js and then run the usual commands. To run with env vars:

```powershell
cd "C:\Users\Administrator\Desktop\Markus\Bhardz website"
npm install
$env:ADMIN_USER = 'admin'; $env:ADMIN_PASS = 's3cret'
npm start
```

Run with Docker locally:

```powershell
docker build -t printing-orders:latest .
docker run -p 3000:3000 -e ADMIN_USER=admin -e ADMIN_PASS=s3cret --name printing-orders printing-orders:latest
```

Deploy via GitHub Actions to GHCR
1. Push this repo to GitHub (create `main` branch).
2. Enable GitHub Packages/Packages permissions if required.
3. Actions will build and publish an image to `ghcr.io/<owner>/<repo>:latest`.
4. Pull/run the published image on any host and set `ADMIN_USER`/`ADMIN_PASS` environment variables in your deployment.

Security reminder
- Change the default admin credentials before exposing publicly.
- Consider adding HTTPS, CSRF protections, rate limits, and stricter upload validation before using in production.

Environment variables and email notifications
- You can configure admin credentials and optional SMTP notification via environment variables. See `.env.example` for the available keys.
- If you set `SMTP_HOST` and `NOTIFY_EMAIL` the app will attempt to send a plain notification email when a new order is created.

Example local run with environment file (PowerShell):

```powershell
cd "C:\Users\Administrator\Desktop\Markus\Bhardz website"
copy .env.example .env
# Edit .env and set SMTP/ADMIN_* values, then:
npm install
node create-sample.js
npm start
```

Admin access

- Visit `http://localhost:3000/admin-login` to sign in with your `ADMIN_USER`/`ADMIN_PASS` credentials (or set new values in `.env`).
- After signing in you'll be redirected to `http://localhost:3000/admin.html` which offers a searchable table of orders and an "Export CSV" button that downloads `/api/orders.csv`.

