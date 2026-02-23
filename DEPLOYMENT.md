# Deploying the EHR System

This app has four parts:

- **Frontend** (Next.js) – port 3000  
- **Backend API** (Express) – port 3001  
- **FHIR server** (HAPI) – port 8080  
- **PostgreSQL** – used by HAPI only  

---

## Deploy through GitHub (recommended)

Deploy by **pushing your code to GitHub** and connecting the repo to hosting services. Each push to your main branch can trigger a new deploy.

### 1. Push your repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in with **GitHub**.
2. Click **Add New… → Project** and import your GitHub repo.
3. Set **Root Directory** to `frontend` (or leave empty if the repo only contains the frontend).
4. **Environment variables** (add in Vercel project settings):
   - `NEXT_PUBLIC_BACKEND_API_URL` = your backend URL (you’ll get this after step 3, e.g. `https://your-backend.up.railway.app`)
   - `NEXT_PUBLIC_FHIR_SERVER_URL` = your FHIR server URL (e.g. from step 3 or your own HAPI URL)
5. Click **Deploy**. Future pushes to `main` will auto-deploy.

### 3. Deploy the backend (Railway or Render)

1. Go to [railway.app](https://railway.app) or [render.com](https://render.com) and sign in with **GitHub**.
2. **New Project** → connect your GitHub repo.
3. Create a **Web Service** with **Root Directory** = `backend`.
   - **Build:** `npm install` (or leave default).
   - **Start:** `npm start`.
4. Add environment variables:
   - `FHIR_SERVER_URL` = URL of your FHIR server (see below).
   - `ALLOWED_ORIGINS` = your Vercel app URL (e.g. `https://your-app.vercel.app`).
5. Deploy and copy the backend URL (e.g. `https://your-backend.up.railway.app`) for the frontend env vars.

**FHIR server for the backend:**  
- **Quick test:** Use a public server, e.g. `https://hapi.fhir.org/baseR4` (read-only; not for saving data).  
- **Real use:** Run the full stack with Docker Compose on a VPS or use a hosted FHIR service, then set `FHIR_SERVER_URL` to that URL.

### 4. Connect everything

| Where        | Variable                         | Set to |
|-------------|-----------------------------------|--------|
| Vercel      | `NEXT_PUBLIC_BACKEND_API_URL`     | Backend URL from Railway/Render |
| Vercel      | `NEXT_PUBLIC_FHIR_SERVER_URL`     | Your FHIR base URL (optional) |
| Backend     | `FHIR_SERVER_URL`                 | Your HAPI FHIR URL |
| Backend     | `ALLOWED_ORIGINS`                 | Your Vercel URL, e.g. `https://your-app.vercel.app` |

After the first deploy, copy the backend URL into Vercel’s `NEXT_PUBLIC_BACKEND_API_URL` and redeploy the frontend if needed.

### 5. GitHub Actions (optional)

The repo includes a workflow that runs on every push to `main`: it builds the frontend and backend and pushes Docker images to **GitHub Container Registry** (ghcr.io). You can use those images to run the app on any server or cloud that supports Docker.

- Workflow file: `.github/workflows/build-and-push.yml`
- After a run, images are at `ghcr.io/YOUR_USERNAME/YOUR_REPO/frontend` and `ghcr.io/YOUR_USERNAME/YOUR_REPO/backend` (or as defined in the workflow).

---

## Option 1: Docker Compose (one server or local)

Run the whole stack with one command from the **repo root**:

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:3001  
- **FHIR:** http://localhost:8080/fhir  

To run in the background:

```bash
docker compose up --build -d
```

### Environment variables (Docker Compose)

Edit `docker-compose.yml` if you need to change:

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_BACKEND_API_URL` | frontend | URL the **browser** uses to call the API (e.g. `https://api.yourdomain.com`) |
| `NEXT_PUBLIC_FHIR_SERVER_URL` | frontend | FHIR base URL shown in the app if needed |
| `FHIR_SERVER_URL` | backend | URL the **server** uses to call the FHIR server (e.g. `http://hapi-fhir:8080/fhir` inside Docker) |
| `ALLOWED_ORIGINS` | backend | Comma-separated list of frontend origins for CORS (e.g. `https://yourdomain.com`) |

### Seeding data after deploy

With the stack running, seed FHIR data from your **host** (not inside a container):

```bash
cd backend
npm install
FHIR_SERVER_URL=http://localhost:8080/fhir node scripts/seed-fhir-patients.js
```

Or run the seed inside the backend container:

```bash
docker compose exec backend sh -c "cd /app && node scripts/seed-fhir-patients.js"
```

(If the backend image doesn’t include `scripts/`, copy them in or run the command above from the host with `FHIR_SERVER_URL` set.)

---

## Option 2: Cloud / hosted deployment

Deploy each part separately and point the frontend at your backend URL.

### Frontend (e.g. Vercel)

1. Push the repo to GitHub and import the **frontend** (or monorepo with root) in Vercel.  
2. Set build command: `cd frontend && npm run build` (or use the frontend directory as root).  
3. Set environment variables:
   - `NEXT_PUBLIC_BACKEND_API_URL` = your backend API URL (e.g. `https://your-backend.railway.app`)
   - `NEXT_PUBLIC_FHIR_SERVER_URL` = your FHIR server URL if the app uses it in the browser  

### Backend (e.g. Railway, Render, Fly.io)

1. Use the **backend** folder as the app root (or set root to `backend`).  
2. Set environment variables:
   - `PORT` = provided by the host (e.g. Railway sets this)
   - `FHIR_SERVER_URL` = your HAPI FHIR URL (must be reachable from the backend server)
   - `ALLOWED_ORIGINS` = your frontend URL(s), e.g. `https://your-app.vercel.app`  

### FHIR server + database

- Run **HAPI FHIR + PostgreSQL** on a VPS or a separate cloud service (e.g. Docker on a small VM, or a managed Postgres + HAPI in Docker).  
- Point the backend’s `FHIR_SERVER_URL` at that HAPI instance.  
- Ensure the backend can reach the FHIR server (no firewall blocking it).  

---

## Checklist for production

- [ ] Set `NEXT_PUBLIC_BACKEND_API_URL` to the real backend URL (HTTPS).  
- [ ] Set `ALLOWED_ORIGINS` on the backend to your frontend origin(s) (HTTPS).  
- [ ] Use HTTPS for frontend and backend.  
- [ ] Keep `FHIR_SERVER_URL` and DB credentials in env vars, not in code.  
- [ ] Run `npm run seed:fhir` (or the seed script) once after the FHIR server is up if you need demo data.  

---

## Quick reference

| Task | Command |
|------|--------|
| Run full stack (Docker) | `docker compose up --build` |
| Stop stack | `docker compose down` |
| Seed FHIR data (host) | `cd backend && FHIR_SERVER_URL=http://localhost:8080/fhir npm run seed:fhir` |
| Clear FHIR data | `cd backend && npm run clear:fhir` |
