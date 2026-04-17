# QR Launching System

Real-time QR-based website launching system. Presenter generates QR code, audience scans to "launch" a website with confirmation in real-time.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Bun |
| Frontend | SvelteKit |
| WebSocket | Bun.serve ws |
| QR Render | qrcode |
| Token | crypto.randomUUID() |

## Quick Start

```bash
# Install dependencies
bun install

# Terminal 1 - Backend (port 3001)
cd apps/backend
bun run dev

# Terminal 2 - Frontend (port 5173)
cd apps/frontend
bun run dev

# Open http://localhost:5173/presenter
```

## Architecture

```
┌─────────────────┐      WebSocket       ┌─────────────────┐      HTTP GET       ┌─────────────────┐
│  LAPTOP (Presenter)◄───────────────────►│  BACKEND SERVER │◄────────────────────│   HP AUDIENCE   │
│  - Generate QR   │  (Session Room/Event)│  - Session Mgmt │   (Scan Trigger)    │  - Open URL QR  │
│  - Listen Event  │                      │  - Emit Signal   │                     │  - Auto-confirm │
│  - Countdown UI  │                      │  - One-time use  │                     │  - Thank you    │
└─────────────────┘                      └─────────────────┘                     └─────────────────┘
```

## Flow

1. Presenter opens `/presenter` → WebSocket connects → Session created with unique token
2. QR Code displayed (encodes: `frontendURL/scan?token=<token>`)
3. Audience scans QR → Backend validates token (one-time use)
4. Backend redirects to frontend `/scan` page + emits `scan:confirmed` via WebSocket
5. Presenter receives event → Shows countdown confirmation

## Environment Variables

### Backend (`apps/backend/.env`)
```
PORT=3001
FRONTEND_URL=http://localhost:5173
TOKEN_EXPIRY_MS=300000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`apps/frontend/.env`)
```
PUBLIC_BACKEND_URL=http://localhost:3001
PUBLIC_WS_URL=ws://localhost:3001
PUBLIC_FRONTEND_URL=http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/scan?token=xxx` | Validate token, redirect to frontend |
| GET | `/session/:id` | Get session info |
| DELETE | `/session/:id` | Delete session |
| WS | `/ws` | WebSocket for presenter |

## WebSocket Events

### Server → Presenter
```json
{ "event": "session:created", "sessionId": "...", "token": "...", "expiresAt": 1234567890 }
{ "event": "token:regenerated", "sessionId": "...", "token": "...", "expiresAt": 1234567890 }
{ "event": "scan:confirmed", "sessionId": "...", "timestamp": 1234567890 }
```

### Presenter → Server
```json
{ "action": "regenerate" }
```

## Session Cleanup

Expired sessions are automatically cleaned every 60 seconds to prevent memory leaks.

## Development

```bash
# Build for production
bun run build

# Run backend only
bun run dev:backend

# Run frontend only
bun run dev:frontend
```

## License

MIT