# VeloGo — Complete Ride Booking & Bike Taxi Platform

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**VeloGo** is an original, production-ready, full-stack mobility platform inspired by the rapid on-demand experience of bike taxis and micro-mobility aggregators (such as Rapido). It features a dedicated customer ride booking experience, an interactive mobile-first driver/captain trip management cockpit, and a comprehensive real-time administrator governance portal.

---

## Table of Contents
1. [Platform Architecture](#1-platform-architecture)
2. [Prerequisites & Supported Versions](#2-prerequisites--supported-versions)
3. [Environment Configuration](#3-environment-configuration)
4. [Local Installation & Quickstart](#4-local-installation--quickstart)
5. [Database Setup & Migrations](#5-database-setup--migrations)
6. [Map, Geocoding & Routing Configuration](#6-map-geocoding--routing-configuration)
7. [Browser Location & Geolocation Guide](#7-browser-location--geolocation-guide)
8. [Ride Lifecycle State Machine](#8-ride-lifecycle-state-machine)
9. [Payment Gateway & Webhook Setup](#9-payment-gateway--webhook-setup)
10. [Production Security, CORS & HTTPS](#10-production-security-cors--https)
11. [Creating the First Administrator](#11-creating-the-first-administrator)
12. [Automated Testing & Verification](#12-automated-testing--verification)
13. [Production Deployment Guide](#13-production-deployment-guide)
14. [Health Checks & Troubleshooting](#14-health-checks--troubleshooting)
15. [Database Backup & Restore](#15-database-backup--restore)
16. [REST API & Swagger Documentation](#16-rest-api--swagger-documentation)

---

## 1. Platform Architecture

VeloGo is engineered as a clean **modular monolith** with strong separation of concerns, strict domain modeling, explicit DTO contracts, and zero frontend-trusted state transitions:

```
                      +------------------------------------+
                      |       VeloGo Single-Page App       |
                      |   React 19 + TypeScript + Leaflet  |
                      |     (Vite Dev / Nginx Gateway)     |
                      +-----------------+------------------+
                                        |
                         REST / JSON    |    STOMP / WebSocket
                         (Port 8080)    |    (/ws, SockJS)
                                        v
                      +------------------------------------+
                      |     Spring Boot 3.3.4 Monolith     |
                      |  Security (JWT) | Dispatch Engine  |
                      |  Fare Engine    | Payment Adapter  |
                      |  Nominatim Proxy| OSRM Routing     |
                      +-----------------+------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
+---------------------------------+           +---------------------------------+
|        Primary Database         |           |       External Integrations     |
|  - Dev: Embedded H2 File DB     |           |  - OSRM Road Geometry (GeoJSON) |
|  - Prod: PostgreSQL 16 PostGIS  |           |  - Nominatim Address Search     |
|  - Flyway Versioned Migrations  |           |  - Razorpay Online Payments     |
+---------------------------------+           +---------------------------------+
```

---

## 2. Prerequisites & Supported Versions

| Technology | Minimum Version | Recommended Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Java JDK** | 21 | 21.0.4+ LTS | Backend runtime |
| **Maven** | 3.9+ | 3.9.8+ | Dependency management & compilation |
| **Node.js** | 20.0.0+ | 20.18.0 LTS or 22+ | Frontend runtime & testing |
| **npm** | 10.0+ | 10.8+ | Package manager |
| **PostgreSQL** | 15.0+ | 16.4+ with PostGIS | Production spatial database |
| **Docker** | 24.0+ | 27.0+ | Containerized production deployment |

---

## 3. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

### Key Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8080` | Port for the Spring Boot backend |
| `SPRING_PROFILES_ACTIVE` | `dev` | Active profile: `dev` (H2 file DB), `docker`, or `prod` (PostgreSQL) |
| `DB_URL` | `jdbc:postgresql://localhost:5432/velogodb` | JDBC connection string |
| `DB_USER` | `velogo_user` | Database username |
| `DB_PASSWORD` | *(required in prod)* | Database password |
| `JWT_SECRET` | *(64-char hex)* | 256-bit signing key for HMAC-SHA256 tokens |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | Razorpay Merchant Key ID |
| `RAZORPAY_KEY_SECRET` | `...` | Razorpay Merchant Secret |
| `RAZORPAY_WEBHOOK_SECRET`| `...` | Secret for verifying incoming Razorpay webhooks |
| `PAYMENT_SIMULATE_MODE` | `true` (dev) / `false` (prod) | Toggle simulated payment confirmation |
| `OSRM_URL` | `https://router.project-osrm.org` | OSRM routing service endpoint |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | OpenStreetMap Nominatim geocoding API |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:80` | Permitted web client origins |

---

## 4. Local Installation & Quickstart

VeloGo runs immediately in local development mode without requiring Docker or any external cloud services.

### Terminal 1: Backend Service (Port 8080)
```bash
cd backend
mvn spring-boot:run
```
- Flyway automatically initializes the local embedded database at `backend/data/velogodb.*`.
- Both REST endpoints and static embedded frontend assets are served on `http://localhost:8080`.
- Swagger UI documentation is available at `http://localhost:8080/swagger-ui.html`.

### Terminal 2: Frontend Dev Server with HMR (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.
- Vite proxies `/api` and `/ws` to `http://localhost:8080` automatically.

---

## 5. Database Setup & Migrations

Database migrations are managed using **Flyway**:

- **Location**: `backend/src/main/resources/db/migration/`
  - `V1__initial_schema.sql`: Core tables (`users`, `captains`, `rides`, `fare_configurations`, `payments`, `ratings`, `coupons`, `support_tickets`, `audit_logs`).
  - `V2__seed_data.sql`: Initial seed data for development testing.
- **Migration Execution**: Flyway applies pending migrations automatically on application startup.
- **Manual Database Reset (Local Dev)**:
  ```powershell
  Remove-Item -Path "backend/data/*" -Recurse -Force
  ```
  Restarting the backend will re-create `velogodb` cleanly.

---

## 6. Map, Geocoding & Routing Configuration

VeloGo utilizes a robust geospatial pipeline:

1. **Map Tiles**: Leaflet 1.9 displays OpenStreetMap raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
2. **Address Autocomplete & Reverse Geocoding**:
   - Client sends queries to `/api/v1/geo/search?q={query}` and `/api/v1/geo/reverse?lat={lat}&lng={lng}`.
   - Spring Boot acts as a compliant reverse-proxy to Nominatim, adding a valid `User-Agent: VeloGo-Mobility/1.0`, handling bounding box viewport bias, and caching results in an in-memory TTL cache to comply with OSM rate limits.
3. **Road Route Calculation**:
   - Routing queries `/api/v1/geo/route?fromLat=...&fromLng=...&toLat=...&toLng=...`.
   - Backend queries OSRM (`/route/v1/driving/...`) with `overview=full&geometries=geojson`.
   - Coordinates are transformed into Leaflet `[lat, lng]` polylines (200+ points) and rendered on the client map.
   - If the public OSRM server is unreachable, the system falls back to Haversine distance with an urban circuity multiplier (1.35x).

---

## 7. Browser Location & Geolocation Guide

When accessing the booking interface:
- **Permission Flow**: The browser requests location permission via the HTML5 Geolocation API (`navigator.geolocation.getCurrentPosition`).
- **Reverse Geocoding**: Once coordinates are acquired, the app centers the map, places a radar-pulse marker, and calls `/api/v1/geo/reverse` to auto-populate the pickup address.
- **Manual Override**: If the user denies permission, no fake coordinates are generated; the user enters their pickup location manually using the address search field or by clicking on the map.
- **HTTPS Requirement**: Modern browsers only grant location access over secure origins (`https://` or `localhost`).

---

## 8. Ride Lifecycle State Machine

```
[Customer Books] 
       │
       ▼
   REQUESTED ──► SEARCHING (Nearby Captains Ranked & Dispatched)
                     │
                     ├─► (No Captain / Timeout) ──► EXPIRED
                     │
                     ▼ (Captain Accepts)
                  ACCEPTED
                     │
                     ▼ (Captain En Route)
                  ARRIVING
                     │
                     ▼ (Captain Arrives at Pickup)
                  ARRIVED
                     │
                     ▼ (Customer shares 4-Digit OTP; Captain submits OTP)
                IN_PROGRESS
                     │
                     ▼ (Destination Reached; Captain taps Complete)
                 COMPLETED
                     │
                     ▼ (Online Razorpay or Cash Settlement)
                   PAID ──► Customer Rates Captain (1-5 Stars)
```

---

## 9. Payment Gateway & Webhook Setup

VeloGo supports two payment flows:
1. **Cash on Delivery (CASH)**: Captain marks the payment collected upon trip completion.
2. **Razorpay Online Payments (RAZORPAY)**:
   - Backend creates a Razorpay Order (`/api/v1/payments/order`).
   - Customer completes checkout via Razorpay Checkout Modal.
   - Backend verifies the HMAC-SHA256 signature (`/api/v1/payments/verify`) using `RAZORPAY_KEY_SECRET`.
   - **Webhook URL**: Configure `https://yourdomain.com/api/v1/payments/webhook` in the Razorpay Dashboard with the secret matching `RAZORPAY_WEBHOOK_SECRET`.
   - **Simulation Mode**: Set `PAYMENT_SIMULATE_MODE=true` for automated local testing without live merchant keys.

---

## 10. Production Security, CORS & HTTPS

- **Stateless JWT**: Bearer tokens signed with HMAC-SHA256, verified on each request by `JwtAuthFilter`.
- **Role-Based Guards**:
  - `ROLE_CUSTOMER`: Access customer booking, history, and receipts.
  - `ROLE_CAPTAIN`: Access driver cockpit, status updates, and GPS streaming.
  - `ROLE_ADMIN`: Access administration overview, fare configuration, and audit logs.
- **CORS**: Configured in `SecurityConfig.java` to restrict allowed origins based on `CORS_ALLOWED_ORIGINS`.
- **Production HTTPS**: Terminated at Nginx or a cloud load balancer (e.g., Cloudflare, AWS ALB) before proxying to port 8080.

---

## 11. Creating the First Administrator

In production, never use public default credentials. To bootstrap the initial administrator:

```bash
# Option A: Register via API then elevate via DB:
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Production Admin",
    "email": "admin@yourcompany.com",
    "phone": "+919876543210",
    "password": "StrongSecretPassword2026!"
  }'

# Update role in PostgreSQL:
psql -U velogo_user -d velogodb -c "UPDATE users SET role = 'ROLE_ADMIN' WHERE email = 'admin@yourcompany.com';"
```

---

## 12. Automated Testing & Verification

Run the test suites to verify system integrity:

```bash
# 1. Backend Unit Tests
cd backend && mvn test

# 2. Frontend Component Tests
cd frontend && npm run test

# 3. End-to-End 11-Step API Lifecycle Suite
node C:\Users\arika\.gemini\antigravity-ide\brain\3241288d-7044-4ec4-9ef9-cc3fadd8d819\scratch\e2e_api_test.mjs

# 4. Geospatial Endpoints Verification (Nominatim, OSRM, Route Polylines)
node C:\Users\arika\.gemini\antigravity-ide\brain\3241288d-7044-4ec4-9ef9-cc3fadd8d819\scratch\test_geo_endpoints.mjs
```

---

## 13. Production Deployment Guide

### Option A: Docker Compose (All-in-One)
```bash
docker-compose up --build -d
```
Starts:
- `velogo-postgres`: PostgreSQL 16 + PostGIS on port 5432.
- `velogo-backend`: Spring Boot application on port 8080.
- `velogo-frontend`: Nginx serving static SPA and reverse proxying on port 80.

### Option B: Cloud Deployment (AWS / GCP / DigitalOcean)
1. Provision a managed PostgreSQL 16 instance.
2. Build the backend JAR:
   ```bash
   cd backend && mvn clean package -DskipTests
   java -jar -Dspring.profiles.active=prod target/velogo-backend-1.0.0.jar
   ```
3. Build the frontend:
   ```bash
   cd frontend && npm run build
   ```
4. Copy `dist/` to an S3/CloudFront bucket or Nginx static directory.

---

## 14. Health Checks & Troubleshooting

- **Backend Health Check**:
  ```bash
  curl http://localhost:8080/actuator/health
  # Expected Response: {"status":"UP"}
  ```
- **Port Conflicts**:
  ```powershell
  # Windows: Check and kill conflicting process on port 8080
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
  ```

---

## 15. Database Backup & Restore

### Backup
```bash
docker exec -t velogo-postgres pg_dump -U velogo_user -d velogodb -F c -b -v -f /var/lib/postgresql/data/backup_$(date +%Y%m%d).dump
```

### Restore
```bash
docker exec -t velogo-postgres pg_restore -U velogo_user -d velogodb -v /var/lib/postgresql/data/backup_20261023.dump
```

---

## 16. REST API & Swagger Documentation

When running locally, explore interactive API documentation:
- **Swagger UI**: `http://localhost:8080/swagger-ui.html`
- **OpenAPI 3 JSON**: `http://localhost:8080/v3/api-docs`

---

## License
MIT License. Created as an original mobility engineering platform.
