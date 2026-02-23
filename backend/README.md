# EHR Backend API

Backend API server that acts as a proxy between the frontend and the HAPI FHIR server.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the backend server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Docker Setup

To run with Docker Compose (includes FHIR server and database):

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (fhir-db)
- HAPI FHIR server (hapi-fhir) on port 8080
- Backend API server (backend-api) on port 3001

## API Endpoints

### Health Check
- `GET /health` - Check if the API is running

### Patients
- `GET /api/patients` - Get all patients from the FHIR server

## Environment Variables

- `PORT` - Backend API server port (default: 3001)
- `FHIR_SERVER_URL` - FHIR server URL (default: http://localhost:8080/fhir)

## Development

For development, use:
```bash
npm run dev
```

This uses Node.js watch mode for automatic restarts on file changes.
