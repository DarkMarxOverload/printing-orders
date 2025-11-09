Deploying to the web — quick guide

I prepared this project so it can be deployed easily. Below are the simplest options; pick whichever you prefer.

1) Render (easy, recommended)

- Create a GitHub repository and push the entire project to it (make sure `main` is your default branch).
- Edit `render.yaml` and replace `<replace-with-your-github-repo>` with `owner/repo` (for example `markus/printing-orders`).
- Go to https://dashboard.render.com/new and choose "Web Service" → connect your GitHub account → select the repo.
- Render will read `render.yaml` and create a service. The `Dockerfile` is present, so Render will build a container automatically.
- Set environment variables in the Render dashboard if you want to change `ADMIN_USER`/`ADMIN_PASS` to secure values.

2) GitHub Actions → GHCR (image build & publish)

- The workflow `.github/workflows/docker-publish.yml` builds and pushes an image to GitHub Container Registry when you push to `main`.
- After a successful action you will find an image at `ghcr.io/<owner>/<repo>:latest`.
- Pull that image on your server or container host and run it (set `ADMIN_USER`/`ADMIN_PASS` env vars).

3) Docker Compose on any server

- Copy repository files to a server with Docker installed and run:

```powershell
docker compose up --build -d
```

- The app will be available on port 3000.

Security checklist before public deploy
- Change admin credentials (don't use the defaults).
- Use HTTPS for the public site.
- Limit upload size and file types in `server.js`.
- Optionally move storage to managed DB (Postgres) for production scale.

If you want I can:
- Create the GitHub repository for you and push the code (I will need your permission and a temporary GitHub access token), or
- Walk you step-by-step to push the repo from your machine, or
- Configure Render automatically (I can provide the exact values you should paste into Render's UI).
