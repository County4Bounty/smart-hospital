# Smart Hospital

Project context and implementation decisions will be documented here.
# Smart Hospital Patient Monitoring System — Project Context

## 1. Project Identity

**Project:** IoT-Based Smart Hospital Patient Monitoring System
**Department:** Electronics and Communication Engineering (ECE)
**Project Type:** ECE Final-Year Project — IoT + Embedded Systems + Web Application + AI/ML

**Development environment:**

* VS Code
* GitHub Copilot Student
* Arduino/C++ for ESP32
* Node.js / Express
* React
* MongoDB / Mongoose
* Socket.IO
* Wokwi for ESP32 simulation

The project is being developed incrementally with one focused change at a time. Existing working functionality must be preserved unless there is a clear reason to change it.

---

# 2. Project Objective

The system is a prototype for continuous patient vital-sign monitoring.

The intended workflow is:

```text
ESP32 / Wokwi
      ↓
Sensor data
      ↓
Wi-Fi
      ↓
Express backend
      ↓
MongoDB
      ↓
Alert engine
      ↓
React dashboard
```

A future AI component will analyze patient trends and provide assistive deterioration/risk insights.

The project is an academic prototype and is **not a certified medical device**.

---

# 3. System Architecture

```text
                    ┌─────────────────────────┐
                    │ Sensors / Mock Sensors  │
                    │                         │
                    │ MAX30102                │
                    │ Heart Rate              │
                    │ SpO₂                    │
                    │ Temperature             │
                    └────────────┬────────────┘
                                 │
                                I²C
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │          ESP32          │
                    │                         │
                    │ Sensor acquisition      │
                    │ Validation              │
                    │ Mock mode               │
                    │ Offline buffering/retry │
                    │ Wi-Fi communication     │
                    └────────────┬────────────┘
                                 │
                              HTTP/Wi-Fi
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Express Backend     │
                    │                         │
                    │ REST API                │
                    │ JWT Authentication     │
                    │ Validation              │
                    │ Deterministic Alerts    │
                    │ Device registry/status  │
                    │ Socket.IO               │
                    └──────────┬─────┬────────┘
                               │     │
                               │     └──────────────┐
                               ▼                    ▼
                    ┌─────────────────┐    ┌────────────────┐
                    │    MongoDB      │    │   Socket.IO    │
                    │                 │    │                │
                    │ Patients        │    │ Real-time      │
                    │ Readings        │    │ events         │
                    │ Alerts          │    └───────┬────────┘
                    │ Users           │            │
                    │ Devices         │            │
                    └─────────────────┘            │
                                                  ▼
                                      ┌────────────────────┐
                                      │   React Dashboard  │
                                      │                    │
                                      │ Patients           │
                                      │ Vitals             │
                                      │ Alerts             │
                                      │ History (charts)   │
                                      │ Devices (admin)    │
                                      └─────────┬──────────┘
                                                │
                                                ▼
                                      ┌────────────────────┐
                                      │ Future AI Module   │
                                      │                    │
                                      │ Trend analysis     │
                                      │ Risk analysis      │
                                      │ Explanations       │
                                      └────────────────────┘
```

---

# 4. Hardware and Simulation

## 4.1 ESP32

The ESP32 is the intended embedded controller.

Responsibilities:

* Acquire sensor readings.
* Perform basic validation.
* Connect to Wi-Fi.
* Send readings to the backend.
* Buffer readings locally and retry when the backend/Wi-Fi is unreachable.
* Provide diagnostic information.
* Support mock-sensor mode when physical hardware is unavailable.

The ESP32 firmware is written in **Arduino/C++**.

The project deliberately does not switch to MicroPython because doing so would require abandoning/reworking the existing Arduino/C++ code and MAX30102 library path.

---

## 4.2 MAX30102

The MAX30102 is intended for:

* Heart-rate measurement.
* SpO₂ measurement.

Communication:

* I²C.

### Hardware limitation

There is currently **no physical MAX30102 hardware available**.

Wokwi was investigated as the simulation environment.

Wokwi does **not provide a native MAX30102 simulation model**, so the project uses a software mock mode instead.

The real MAX30102 code path remains preserved for future physical-hardware use.

---

## 4.3 Temperature Sensor

The existing ESP32 firmware contains temperature-sensor handling.

The original hardware path includes LM35 support.

DHT11 support exists only as an incomplete/placeholder branch and is not currently considered complete.

---

# 5. Mock Sensor Mode

A reversible compile-time mock mode has been implemented.

The real sensor code paths remain preserved and are not replaced.

When mock mode is enabled:

* Heart rate normally varies around approximately **72–78 BPM**.
* SpO₂ normally varies around approximately **97–99%**.
* Every approximately 30-second cycle contains an approximately 5-second abnormal window.
* During the abnormal window:

  * Heart rate ≈ **145 BPM**
  * SpO₂ ≈ **87%**
  * Temperature ≈ **38.6°C**

These abnormal values are synchronized to simulate a believable deterioration event for demonstration/testing.

The existing reading-submission function and JSON payload remain unchanged between real/mock modes.

This mock mode is intended for:

* Wokwi demonstration
* Backend integration testing
* Alert-system testing
* Development without physical hardware

It must not be represented as actual sensor measurement.

### Multi-patient mock data generator

`backend/scripts/mock-multi-patient.js` posts simulated readings for several patients (`P-1001`, `P-1002`, `P-1003`) on independent timers, without requiring Wokwi or physical hardware. Each patient has its own staggered abnormal-window cycle so they don't all spike together. It includes a `deviceId` (`ESP32-<patientId>`) in each posted reading so matching registered devices flip to "online" with a live last-seen time.

---

# 6. Wokwi Simulation

Wokwi is currently the project's hardware simulation environment.

The simulation uses:

* ESP32
* Arduino/C++
* Wokwi simulated Wi-Fi
* Mock sensor mode
* Offline buffering/retry (see §12a)

Wokwi provides simulated internet connectivity, allowing the simulated ESP32 to communicate with the actual local backend through a temporary tunnel.

The Wokwi simulation does not simulate the MAX30102 itself.

---

# 7. Backend

## Technology

* Node.js
* Express
* Mongoose
* MongoDB
* Socket.IO
* JWT
* bcrypt

## Responsibilities

The backend:

* Receives ESP32 readings.
* Validates sensor values.
* Stores readings.
* Manages patients.
* Manages alerts.
* Manages registered devices and their online/offline status.
* Authenticates users.
* Provides protected API routes.
* Generates deterministic threshold alerts.
* Emits Socket.IO events.
* Provides data to the React frontend.

---

# 8. MongoDB

MongoDB is now fully installed and operational.

The local database is:

```text
smart_hospital
```

Expected URI:

```text
mongodb://127.0.0.1:27017/smart_hospital
```

The backend `.env` contains the actual local configuration.

MongoDB has been verified using:

```text
mongosh
```

and:

```text
db.runCommand({ ping: 1 })
```

returned:

```text
{ ok: 1 }
```

The MongoDB service is running and configured for automatic startup.

---

# 9. Database Models

Existing Mongoose models cover:

### Users

* Email
* Password hash
* Role

### Patients

* Patient ID
* Name
* Demographic information
* Room information
* Assigned doctor where applicable

### Health Readings

* Patient ID
* Heart rate
* SpO₂
* Temperature
* Timestamp

### Alerts

* Patient ID
* Alert type
* Value
* Threshold
* Direction
* Acknowledgement state
* Acknowledgement timestamp
* Timestamp

### Devices

* Device ID (unique)
* Label
* Assigned patient ID (optional)
* Last-seen timestamp (used to derive online/offline status; online if seen within the last 2 minutes)

MongoDB is now used as the persistent storage layer for patients, readings, alerts and devices.

The previous in-memory `store.js` approach has been removed.

---

# 10. Demo Patient Seeding

The project uses demo patient records for development/demo purposes.

Seeding is currently lazy:

* It occurs when the authenticated patient data is first requested.
* It does not require the demo patients to be manually inserted beforehand.

This behavior has been verified.

---

# 11. Authentication

The backend uses:

* JWT authentication
* bcrypt password handling

The backend login endpoint has been verified successfully.

## Frontend authentication and role enforcement — Implemented

`frontend/src/main.jsx` implements a real login/logout flow on top of the existing hash-based router (no `react-router-dom` — deliberately kept on the existing lightweight pattern to avoid introducing a new routing dependency under time pressure):

* A real login form submits to the existing `POST /api/auth/login` via the shared `api` client — no environment-credential auto-login remains.
* The session/JWT is restored from `localStorage` on load, so a refresh does not log the user out.
* A hash-based route guard redirects an unauthenticated visitor to `#/login` regardless of what hash is requested, and redirects an already-authenticated visitor away from `#/login`.
* Role-gated routes (`#/thresholds`, `#/devices`, and admin-only nav links such as Team/Thresholds/Devices) redirect non-admins even on **direct hash navigation**, not just hidden nav links — confirmed by manually typing an admin route into the hash while logged in as a non-admin.
* Logout clears the stored session and redirects to `#/login`; a refresh afterward does not silently log back in.

Manually verified end-to-end: fresh load → login form, non-admin login → admin nav hidden, direct hash navigation to an admin route as non-admin → redirected, refresh while logged in → session persists, logout → session cleared and does not silently restore.

---

# 12. Deterministic Alert System

The deterministic alert engine is a core part of the project.

It evaluates vital-sign thresholds independently of AI.

Current demonstrated thresholds include:

```text
Heart rate > 120
SpO₂ < 92
Temperature > 38°C
```

The exact configured values should always be taken from the implementation rather than assumed from this documentation.

### Critical architecture rule

```text
Deterministic Alerts ≠ AI
```

The deterministic alert engine must remain functional even if the future AI service is unavailable.

AI must not replace emergency/threshold alert generation.

---

# 12a. ESP32 Offline Buffering

Implemented: a fixed-size (20-entry) in-memory FIFO ring buffer on the ESP32.

Behavior:

* A reading is buffered if the POST fails (non-2xx response) or if `WiFi.status() != WL_CONNECTED` — the Wi-Fi check happens before attempting the HTTP request, so a dropped link buffers immediately rather than waiting on a doomed request to time out.
* Before sending a new reading each cycle, the device first attempts to flush buffered readings oldest-first, removing each only on confirmed POST success.
* If a flush attempt fails, flushing stops for that cycle (not blocking the new reading) and resumes next cycle.
* If the buffer is full, the oldest entry is dropped (FIFO) and logged.
* The buffer is in-memory only — lost on power cycle/reset, not persisted to flash. This is an accepted limitation for this project's scope.
* All buffer/flush/drop events are logged to Serial for observability in the Wokwi Serial Monitor.

This does not change the underlying request logic (headers, auth token, URL, JSON shape) — it only wraps the existing submission call.

---

# 13. React Frontend

The frontend uses React.

The dashboard has been connected to the backend and successfully verified.

The frontend currently loads:

* Patients
* Patient readings
* Alerts
* Patient history (range-filtered, charted — see §13a)
* Devices (admin-only — see §13b)

The existing visual design should be preserved when extending functionality.

A previous blank-page issue was diagnosed and fixed.

### Blank-page root cause

`main.jsx` defined the `App` component but did not mount it into the React root.

The missing render call was added:

```js
createRoot(document.getElementById('root')).render(<App />);
```

The dashboard was subsequently verified as rendering correctly with seeded patient data.

---

# 13a. Patient History + Chart.js

Implemented in `frontend/src/views/History.jsx`, backed by an extended `GET /api/readings/:patientId` route.

Backend:

* Accepts `range` query param: `1h`, `6h`, `24h`, `7d` (default `24h`); invalid/missing values safely fall back to `24h`.
* Filters readings by patient ID and the computed time window, sorted ascending (oldest first).
* Caps the raw query at ~5000 rows, then evenly downsamples to at most 500 points across the full range (not just the first/last 500), so the chart reflects the whole window rather than being biased toward one end.
* Auth/role scope unchanged (`requireAuth` only, same as before).

Frontend:

* Range selector (`1h`/`6h`/`24h`/`7d`) re-fetches on both patient and range change.
* Chart.js line chart with **three independent, fixed-range axes** (not auto-scaled from data, so the chart reads consistently regardless of what the current data happens to span):
  * `yHeartRate` — left, 40–180 bpm
  * `ySpo2` — right, 70–100%
  * `yTemperature` — right (offset to avoid overlapping `ySpo2`), 34–42°C
* Only the heart-rate axis draws gridlines, to avoid clutter.
* Empty state ("No data for this period") when a patient/range has no readings.
* Uses the existing shared authenticated `api` client — no separate fetch path.

---

# 13b. Device Management (Admin-only)

Implemented in `frontend/src/views/Devices.jsx`, backed by new `/api/devices` routes.

Backend:

* `GET /api/devices` (`requireAuth`) — lists all devices with assigned patient name and a derived `status` (`online` if `lastSeenAt` within the last 2 minutes, else `offline`).
* `POST /api/devices` (`requireRole('admin')`) — registers a new device (`deviceId`, `label`, optional `assignedPatientId`); rejects duplicate `deviceId` and unknown `assignedPatientId`.
* `PATCH /api/devices/:deviceId` (`requireRole('admin')`) — updates `label` and/or `assignedPatientId`.
* `POST /api/readings` now accepts an optional `deviceId` in the body and updates that device's `lastSeenAt` on receipt — this is how a device flips to "online".

Frontend:

* "Devices" nav link and `#/devices` route, visible/accessible to `admin` role only (non-admins are redirected to `#/`).

---

# 14. Backend ↔ Frontend Verification

The frontend/backend integration has been verified.

The following have been confirmed:

* Backend login works.
* MongoDB connection works.
* Patient data can be retrieved.
* Dashboard renders.
* Seeded patient data appears.
* Frontend production build succeeds.
* Device registration/assignment and online-status flip (via `mock-multi-patient.js` sending `deviceId`) verified.
* Patient history chart (range selector + three-axis Chart.js) verified against a build.

---

# 15. ESP32 → Backend Integration

The complete simulated pipeline has been successfully verified:

```text
Wokwi ESP32
    ↓
Simulated Wi-Fi
    ↓
Temporary tunnel
    ↓
Real Express backend
    ↓
MongoDB
    ↓
Deterministic alert engine
```

An abnormal mock reading successfully generated three backend alerts:

| Alert            | Value | Threshold | Direction |
| ---------------- | ----: | --------: | --------- |
| Heart rate high  |   145 |       120 | above     |
| SpO₂ low         |    87 |        92 | below     |
| Temperature high |  38.6 |        38 | above     |

This proves that the deterministic alert system works with sensor-shaped data flowing through the actual simulated IoT pipeline, backend and database.

This has been confirmed for multiple simulated patient IDs (`P-1001`, `P-1002`).

---

# 16. Temporary Tunnel

Because Wokwi cannot directly access the private local backend, a temporary tunneling service is used.

The tunnel:

```text
Wokwi → Internet → Tunnel → localhost:4000
```

Important:

* Tunnel URLs are temporary.
* URLs may change after restarting the tunnel.
* Login tokens used by the ESP32 simulation are also temporary.
* A fresh tunnel URL/token may be required for a future simulation session.

Do not treat a previous tunnel URL or token as permanent configuration.

---

# 17. HTTP/HTTPS Simulation Limitation

Wokwi's simulated HTTPS/TLS client produced connection failures.

The problem was isolated by testing a separate known-reliable public HTTPS service, which failed in the same manner.

This was determined to be a simulator limitation rather than a project backend problem.

### Current simulation workaround

The Wokwi simulation uses **plain HTTP** through the tunnel.

This is explicitly a simulation-only workaround.

### Real deployment requirement

When deploying to actual hardware:

```text
Use HTTPS.
```

Do not treat the simulation's plain HTTP configuration as production IoT security.

---

# 18. ESP32 Diagnostic Logging

Diagnostic logging has been added to the ESP32 sketch.

It reports:

* Wi-Fi connection progress.
* Assigned IP address.
* Generated heart rate.
* Generated SpO₂.
* Generated temperature.
* HTTP response code.
* Decoded HTTP error information.
* Offline buffer events: reading buffered, flush attempt success/failure, reading dropped (buffer full).

This makes the Wokwi simulation observable through the Serial Monitor.

---

# 19. Current Verified Status

| Component                            | Status                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| MongoDB installation                  | ✅ Complete                                                          |
| MongoDB connection                    | ✅ Verified                                                          |
| Backend `.env`                        | ✅ Created                                                           |
| Backend authentication                | ✅ Verified                                                          |
| MongoDB persistence                   | ✅ Working                                                           |
| Demo patient seeding                  | ✅ Verified                                                          |
| React dashboard rendering             | ✅ Verified                                                          |
| Frontend/backend integration          | ✅ Verified                                                          |
| ESP32 firmware structure              | ✅ Implemented                                                       |
| Wokwi simulation                      | ✅ Working (verified for `P-1001` and `P-1002`)                      |
| Mock sensor mode                      | ✅ Implemented                                                       |
| Multi-patient mock generator          | ✅ Implemented (`mock-multi-patient.js`, P-1001/1002/1003)           |
| ESP32 → backend communication         | ✅ Verified                                                          |
| ESP32 offline buffering               | ✅ Implemented (§12a)                                                |
| Deterministic alerts                  | ✅ Verified end-to-end (`P-1001`, `P-1002`)                          |
| Device management                     | ✅ Implemented (§13b) — admin-only CRUD, online/offline status       |
| Patient history / charts              | ✅ Implemented (§13a) — range-filtered, three-axis Chart.js          |
| MAX30102 physical reading             | 🟡 Pending physical hardware                                        |
| DHT11 support                         | ⬜ Incomplete                                                        |
| Login/logout + role-gated routing     | ✅ Implemented and manually verified (§11)                           |
| Patient management                    | 🟡 Add/update UI appears wired in `main.jsx` — completeness/edge cases not re-verified this session |
| User management                       | 🟡 `Users` view exists — completeness not re-verified this session  |
| Threshold management UI                | 🟡 `Thresholds` view exists and calls backend — completeness not re-verified this session |
| Full Socket.IO frontend verification  | ⬜ Not implemented                                                   |
| Notification delivery                 | ⬜ Not implemented                                                   |
| AI trend/risk analysis                | ⬜ Not implemented                                                   |
| AI traceability/disclaimer            | ⬜ Not implemented                                                   |
| Comprehensive testing                 | ⬜ Not completed                                                     |

---

# 20. AI Feature — Planned

AI is intentionally deferred until the core monitoring pipeline is stable.

The intended AI feature is:

**AI-assisted patient deterioration/trend analysis**

The AI should analyze recent and historical patient data rather than simply checking whether one measurement crosses a threshold.

Potential inputs:

* Heart rate
* SpO₂
* Temperature
* Recent trend
* Rate of change
* Patient baseline
* Frequency of abnormal readings
* Alert history
* Historical readings

Potential outputs:

* Risk indicator
* Trend description
* Contributing factors
* Change from baseline
* Suggested monitoring action

Example conceptual output:

```text
Risk Level: Elevated

Contributing factors:
- SpO₂ has decreased compared with the recent baseline.
- Heart rate has increased over the recent observation window.
- Multiple abnormal readings occurred consecutively.

Recommendation:
Increase monitoring frequency and review the patient.
```

This is an illustrative format, not an implemented AI output.

---

# 21. AI Safety Boundary

The AI feature is an **assistive decision-support component**.

It must:

* Not diagnose diseases.
* Not replace deterministic alerts.
* Not invent measurements.
* Clearly identify AI-generated information.
* Show the relevant input/time window where practical.
* Handle insufficient data explicitly.
* Continue allowing the monitoring system to operate if AI is unavailable.

The AI must remain architecturally separate from the deterministic alert engine.

---

# 22. Planned AI Architecture

```text
MongoDB
   ↓
Historical Patient Data
   ↓
Feature Extraction
   ↓
AI / ML Analysis
   ↓
Risk / Trend Result
   ↓
Express Backend
   ↓
React Dashboard
```

The exact AI/ML model has not yet been selected.

Do not arbitrarily introduce an LLM or machine-learning model without first defining:

* Prediction target
* Available dataset
* Features
* Training/evaluation strategy
* Expected output
* Limitations

---

# 23. Remaining Development Roadmap

Completed since the original roadmap was written: ESP32 offline buffering, device management, patient history/chart visualization, and login/logout with role-gated routing (§11).

**Timeline constraint:** under one week to submission/viva as of this writing — the order below is deliberately scaled down accordingly (no full-size AI pipeline; a small, honest, offline-trained model with lightweight Node-side inference instead of a live Python service).

Suggested remaining order:

1. Verify/implement frontend real-time Socket.IO updates.
2. Re-verify patient/user/threshold management completeness against actual requirements (currently only partially confirmed — see §19).
3. Minimal notification workflow (visible dashboard alert → acknowledgement; no external SMS/WhatsApp).
4. Automated integration tests for core endpoints (auth, readings, alerts, patient/device CRUD) — a regression safety net before AI work begins.
5. Design AI features/data (from `mock-multi-patient.js`-style synthetic data, explicitly labeled as synthetic).
6. Train + evaluate a small, explainable model (e.g. logistic regression / small decision tree) offline in Python/scikit-learn.
7. Port the trained model's logic into the Node backend for inference — avoid a live cross-process Python service during the demo.
8. AI Insights UI with traceability (risk, contributing factors, analysis window, model version, explicit "not a diagnosis" disclaimer).
9. Full system testing pass: normal / abnormal / network-loss-buffering / AI-trend demo script.
10. Documentation, slides, and demo rehearsal — treat this as its own day, not an afterthought.

Do not skip directly to AI if a prerequisite data pipeline is unreliable.

---

# 24. Development Rules for GitHub Copilot

This file is the project's current source of truth.

Before modifying code, Copilot should:

1. Read this file.
2. Inspect the relevant existing implementation.
3. Identify what is already implemented.
4. Avoid rebuilding working functionality.
5. Avoid changing unrelated modules.
6. Make one coherent change at a time.
7. Test the change.
8. Report changed files.
9. Report verification results.
10. Clearly distinguish implemented features from planned features.

Never claim a feature is complete unless it has actually been implemented and tested.

Before a major architectural change, explain the proposed change and why it is necessary.

---

# 25. Important Simulation Notes

The following values/configuration are simulation-specific:

* Mock sensor mode.
* Wokwi Wi-Fi configuration.
* Temporary tunnel URL.
* Temporary ESP32 authentication token.
* Plain HTTP transport.

These must not automatically be treated as production hardware configuration.

Before physical deployment:

* Disable mock mode.
* Restore actual sensor acquisition.
* Use real MAX30102 hardware.
* Complete temperature sensor implementation.
* Use HTTPS.
* Remove temporary tunnel configuration.
* Use secure production credentials.
* Review authentication and authorization.

---

# 26. Project Location

The project is intentionally outside OneDrive.

```text
C:\PROJECTS\smart-hospital
```

Backend:

```text
C:\PROJECTS\smart-hospital\backend
```

Frontend:

```text
C:\PROJECTS\smart-hospital\frontend
```

This location should be preserved unless there is a specific reason to move the project.

---

# 27. Environment Configuration

Backend `.env.example` uses:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/smart_hospital
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5173
BOOTSTRAP_USER_EMAIL=doctor@smart-hospital.local
BOOTSTRAP_USER_PASSWORD=replace-with-a-local-password
```

Actual `.env` files contain local secrets and must not be committed to Git.

`backend/.gitignore` has been configured to protect the backend `.env`.

---

# 28. Current Milestone

The project has reached a significant working milestone:

```text
Wokwi simulated ESP32
        ↓
Mock physiological readings
        ↓
Simulated Wi-Fi
        ↓
Temporary tunnel
        ↓
Express backend
        ↓
JWT authentication
        ↓
MongoDB persistence
        ↓
Deterministic threshold engine
        ↓
Alerts
        ↓
React dashboard
```

This end-to-end path has been demonstrated successfully, including for multiple simulated patients (`P-1001`, `P-1002`).

Since this milestone, the following have been added on top of this verified foundation:

* ESP32 offline buffering/retry (§12a).
* Device registration and management, admin-only (§13b).
* Patient history view with range-filtered, three-axis Chart.js charting (§13a).
* A multi-patient mock data generator (`mock-multi-patient.js`) for exercising multiple patients without Wokwi/hardware.

The next development work should build on this verified foundation rather than replacing it.