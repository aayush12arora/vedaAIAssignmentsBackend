# VedaAI Assignment/Question Paper Generator Backend

Production API base URL:

`https://api.aayushdevcreations.in/api/`

## 1) Executive Summary

VedaAI Backend is the core service that powers AI-assisted assignment creation and question paper generation.
It provides:

- Assignment lifecycle management (create, update, delete, retrieve)
- Asynchronous AI question generation pipeline
- Real-time progress updates through WebSockets
- Question paper management and PDF export
- Caching and queue-backed performance for scale

This backend is designed to support both operational reliability (queue + retries + caching) and product UX (live generation status + downloadable outputs).

## 2) Technology Stack

### Core Runtime

- Node.js
- Express.js

### Data and State

- MongoDB (Mongoose)
- Redis (cache + queue connection)

### AI and Processing

- Google Gemini (`@google/generative-ai`)
- BullMQ (background job processing)

### Real-Time and File Handling

- Socket.IO (real-time events)
- Multer (file upload)
- pdf-parse (PDF text extraction)
- PDFKit (question paper PDF generation)

### Utilities

- dotenv
- cors
- uuid

## 3) High-Level Architecture

```text
Frontend (React)
	|
	| HTTPS + WebSocket
	v
Backend API (Express + Socket.IO)
	|                |
	|                +--> WebSocket rooms per assignment
	|
	+--> MongoDB (Assignments, QuestionPapers)
	+--> Redis (cache keys + BullMQ connection)
	+--> BullMQ Worker (AI generation jobs)
				|
				+--> Gemini API
				+--> Save generated paper in MongoDB
				+--> Emit progress/completion events
```

## 4) Infrastructure Used

Current production setup (as used by the project):

- **Public API Domain**: `api.aayushdevcreations.in`
- **Protocol**: HTTPS
- **Application Host**: AWS EC2 (backend process)
- **Database**: MongoDB Atlas
- **Cache/Queue Broker**: Redis
- **Background Processing**: BullMQ worker running with backend service
- **Real-time Transport**: WebSocket (Socket.IO)

Operational characteristics:

- API remains responsive while heavy generation runs in background.
- Worker retries failed jobs (BullMQ attempt/backoff strategy).
- Redis caching reduces repeated read latency.
- Socket rooms isolate progress events by assignment ID.

## 5) Business Workflow (Founder View)

### Assignment-to-Paper Flow

1. Teacher creates assignment with subject, grade, question pattern, difficulty mix, and optional source file.
2. Backend stores assignment as `draft`.
3. Frontend triggers generation (`POST /assignments/:id/generate`).
4. Backend enqueues a BullMQ job and marks assignment `processing`.
5. Worker calls Gemini to generate section-wise questions.
6. Worker creates/updates question paper record, marks assignment `completed`, and links `generatedPaperId`.
7. WebSocket events stream progress and final completion to the user interface.
8. User views paper, edits if needed, and exports PDF.

### Status Lifecycle

- `draft` -> created, not yet generating
- `processing` -> generation in progress
- `completed` -> question paper generated successfully
- `failed` -> generation failed with an error message

## 6) Project Structure

```text
backend/
  src/
	 config/         # env config, MongoDB, Redis
	 controllers/    # API business logic
	 middlewares/    # error handling, upload parsing
	 models/         # Mongoose schemas
	 routes/         # API route mapping
	 services/       # Gemini, PDF, Socket services
	 workers/        # BullMQ queue and worker processor
	 server.js       # app bootstrap + startup/shutdown
```

## 7) Environment Variables

Create `backend/.env` with:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS
FRONTEND_URL=http://localhost:3000
FRONTEND_URLS=http://localhost:3000,http://127.0.0.1:3000

# Upload (optional override)
UPLOAD_MAX_FILE_SIZE=10485760
```

## 8) Local Development

### Install

```bash
npm install
```

### Run backend + Redis helper (Windows flow in this repo)

```bash
npm run dev
```

### Run backend only

```bash
npm run dev:no-redis
```

### Production start

```bash
npm start
```

## 9) API Reference

Base URL:

`https://api.aayushdevcreations.in/api/`

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health and timestamp |

### Assignments

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/assignments` | Create assignment (supports multipart file upload) |
| GET | `/assignments` | List assignments (optional query: `status`, `limit`, `offset`) |
| GET | `/assignments/:id` | Fetch single assignment |
| PUT | `/assignments/:id` | Update assignment |
| DELETE | `/assignments/:id` | Delete assignment |
| POST | `/assignments/:id/generate` | Start AI generation job |
| POST | `/assignments/:id/regenerate` | Re-run generation |
| GET | `/assignments/:id/paper` | Fetch generated paper for assignment |
| POST | `/assignments/:id/upload` | Upload/replace source file for assignment |

### Question Papers

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/papers` | List papers (optional query: `assignmentId`, `limit`, `offset`) |
| GET | `/papers/assignment/:assignmentId` | Get latest paper by assignment ID |
| GET | `/papers/:id` | Fetch paper by ID |
| GET | `/papers/:id/questions` | Get questions with optional filters (`sectionType`, `difficulty`) |
| PUT | `/papers/:id` | Update paper content |
| DELETE | `/papers/:id` | Delete paper |
| GET | `/papers/:id/pdf` | Download generated PDF |

## 10) Real-Time Events (Socket.IO)

Client subscribes per assignment room:

- `subscribe:assignment` with `assignmentId`
- `unsubscribe:assignment` with `assignmentId`

Server emits:

- `job:status`
- `generation:progress`
- `generation:complete`
- `generation:error`

This enables live processing UI (progress bars, status badges, completion transitions).

## 11) Caching and Consistency

- Assignment list and detail responses are cached in Redis.
- Cache is invalidated when assignments or papers change state.
- Worker also clears relevant caches on job completion/failure.

Outcome: fast reads without stale processing/completion status in normal operation.

## 12) Security and Operational Notes

- Use environment variables for all secrets.
- Restrict CORS to approved frontend origins via `FRONTEND_URLS`.
- Keep Redis and MongoDB credentials private and rotated.
- Run backend behind HTTPS in production.
- Monitor queue failures and error rates (`failed` assignments).

## 13) Trackers

Core product KPIs this backend can support:

- Assignment creation volume
- Generation success rate (`completed` vs `failed`)
- Median generation time
- PDF download frequency
- Active institutions/subjects/grades

Operational KPIs:

- API latency (`GET /assignments`, `GET /papers/:id`)
- Queue backlog and retry counts
- Worker failure categories (Gemini/API/schema issues)
- Socket connection stability

## 14) Current Product Value Delivered

- End-to-end assignment creation and AI paper generation
- Real-time feedback during long-running generation
- Persistent papers with update/regenerate capabilities
- Downloadable PDF output for classroom use
- Scalable architecture pattern ready for growth

---

For integration, use:

`https://api.aayushdevcreations.in/api/`
