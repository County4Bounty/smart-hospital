# Smart Hospital Patient Monitoring System

ECE IoT prototype: ESP32 sensors -> Express REST API -> MongoDB-compatible data layer -> React dashboard.

## Start

1. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` and `MONGODB_URI`.
2. In `backend`, run `npm install`, then `npm test` and `npm run dev`.
3. In `frontend`, run `npm install`, then `npm run dev`.

The current backend uses a deterministic in-memory store so the API and dashboard can be exercised before MongoDB is provisioned. MongoDB models and JWT authentication are the next implementation slice. Threshold alerts remain independent from the optional AI analysis service.
