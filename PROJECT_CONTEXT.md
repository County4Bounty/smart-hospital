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
                    └─────────────────┘            │
                                                  ▼
                                      ┌────────────────────┐
                                      │   React Dashboard  │
                                      │                    │
                                      │ Patients           │
                                      │ Vitals             │
                                      │ Alerts             │
                                      │ History            │
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

---

# 6. Wokwi Simulation

Wokwi is currently the project's hardware simulation environment.

The simulation uses:

* ESP32
* Arduino/C++
* Wokwi simulated Wi-Fi
* Mock sensor mode

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

MongoDB is now used as the persistent storage layer for patients, readings and alerts.

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

The backend currently uses:

* JWT authentication
* bcrypt password handling

The backend login endpoint has been verified successfully.

## Current frontend authentication limitation

The frontend currently does **not** have a real login screen.

Instead:

* It automatically logs in using environment-configured credentials.
* The JWT is stored in `localStorage`.
* There is currently no frontend login form.
* There is currently no logout UI.
* There is currently no frontend router/auth guard.

This is acceptable for the current local development/demo stage but is not the intended final authentication design.

### Planned future authentication work

1. Add `react-router-dom`.
2. Add `/login`.
3. Add a real login form.
4. Add authentication guard.
5. Remove automatic environment-based login.
6. Add logout.
7. Implement Admin/Doctor/Nurse role enforcement.
8. Test multiple roles.

Do not implement this unless it is selected as the next development task.

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

# 13. React Frontend

The frontend uses React.

The dashboard has been connected to the backend and successfully verified.

The frontend currently loads:

* Patients
* Patient readings
* Alerts

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

# 14. Backend ↔ Frontend Verification

The frontend/backend integration has been verified.

The following have been confirmed:

* Backend login works.
* MongoDB connection works.
* Patient data can be retrieved.
* Dashboard renders.
* Seeded patient data appears.
* Frontend production build succeeds.

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

This makes the Wokwi simulation observable through the Serial Monitor.

---

# 19. Current Verified Status

| Component                            | Status                       |
| ------------------------------------ | ---------------------------- |
| MongoDB installation                 | ✅ Complete                   |
| MongoDB connection                   | ✅ Verified                   |
| Backend `.env`                       | ✅ Created                    |
| Backend authentication               | ✅ Verified                   |
| MongoDB persistence                  | ✅ Working                    |
| Demo patient seeding                 | ✅ Verified                   |
| React dashboard rendering            | ✅ Verified                   |
| Frontend/backend integration         | ✅ Verified                   |
| ESP32 firmware structure             | ✅ Implemented                |
| Wokwi simulation                     | ✅ Working                    |
| Mock sensor mode                     | ✅ Implemented                |
| ESP32 → backend communication        | ✅ Verified                   |
| Deterministic alerts                 | ✅ Verified end-to-end        |
| MAX30102 physical reading            | 🟡 Pending physical hardware |
| DHT11 support                        | ⬜ Incomplete                 |
| ESP32 offline buffering              | ⬜ Not implemented            |
| Full role enforcement                | ⬜ Not implemented            |
| Patient management                   | ⬜ Incomplete                 |
| User management                      | ⬜ Incomplete                 |
| Device management                    | ⬜ Not implemented            |
| Threshold management UI              | ⬜ Not implemented            |
| Full patient history / charts        | ⬜ Not implemented            |
| Full Socket.IO frontend verification | ⬜ Not implemented            |
| Notification delivery                | ⬜ Not implemented            |
| AI trend/risk analysis               | ⬜ Not implemented            |
| AI traceability/disclaimer           | ⬜ Not implemented            |
| Comprehensive testing                | ⬜ Not completed              |

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

The remaining work should be approached incrementally.

Suggested order:

1. Improve authentication and role handling.
2. Complete patient history and chart visualization.
3. Verify/implement frontend real-time Socket.IO updates.
4. Improve patient/device/threshold management.
5. Complete ESP32 firmware behavior.
6. Add offline buffering/retry behavior if required.
7. Improve notification workflow.
8. Expand automated tests.
9. Design the AI data pipeline.
10. Select and implement an appropriate AI/ML approach.
11. Integrate AI insights into the dashboard.
12. Perform complete system testing.
13. Prepare final project documentation and presentation.

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

This end-to-end path has been demonstrated successfully.

The next development work should build on this verified foundation rather than replacing it.
