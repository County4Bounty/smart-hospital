#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"

#ifndef USE_MOCK_SENSORS
#define USE_MOCK_SENSORS 1
#endif

// Set TEMPERATURE_SENSOR to LM35 or DHT11 to match the connected hardware.
#define TEMPERATURE_SENSOR LM35
// Wokwi-simulation-only values; revert to real credentials before flashing actual hardware.
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
// Simulation-only plain HTTP workaround because Wokwi's simulated TLS stack is unreliable; real hardware should use HTTPS.
const char* API_URL = "http://replace-with-tunnel-or-server/api/readings";
const char* API_TOKEN = "replace-with-device-token";
const char* PATIENT_ID = "P-1001";

MAX30105 max30102;
unsigned long lastPost = 0;

// Simple in-memory FIFO for failed readings. Entries are lost on power cycle/reset;
// readings are not persisted to flash, which is accepted for this project's scope.
struct PendingReading {
  float heartRate;
  float spo2;
  float temperature;
  unsigned long timestamp;
};

const size_t PENDING_READING_CAPACITY = 20;
PendingReading pendingReadings[PENDING_READING_CAPACITY];
size_t pendingReadingHead = 0;
size_t pendingReadingCount = 0;

float readTemperatureC() {
#if USE_MOCK_SENSORS
  const bool abnormal = (millis() % 30000UL) >= 25000UL;
  return abnormal ? 38.6f : 36.8f + ((millis() / 1000UL) % 5) * 0.1f;
#else
#if TEMPERATURE_SENSOR == LM35
  const int raw = analogRead(34);
  return (raw / 4095.0f) * 3.3f * 100.0f;
#else
  // Replace this branch with the chosen DHT11 library and data pin.
  return NAN;
#endif
#endif
}

void readMockVitals(float& heartRate, float& spo2) {
  const bool abnormal = (millis() % 30000UL) >= 25000UL;
  heartRate = abnormal ? 145.0f : 72.0f + ((millis() / 1000UL) % 7);
  spo2 = abnormal ? 87.0f : 97.0f + ((millis() / 2000UL) % 3);
}

bool validReading(float heartRate, float spo2, float temperature) {
  return heartRate >= 20 && heartRate <= 240 && spo2 >= 50 && spo2 <= 100 && temperature >= 25 && temperature <= 45;
}

void bufferReading(float heartRate, float spo2, float temperature, unsigned long timestamp) {
  if (pendingReadingCount == PENDING_READING_CAPACITY) {
    pendingReadingHead = (pendingReadingHead + 1) % PENDING_READING_CAPACITY;
    pendingReadingCount--;
    Serial.println("Reading dropped: pending buffer full");
  }

  const size_t insertIndex = (pendingReadingHead + pendingReadingCount) % PENDING_READING_CAPACITY;
  pendingReadings[insertIndex] = { heartRate, spo2, temperature, timestamp };
  pendingReadingCount++;
  Serial.print("Reading buffered (pending=");
  Serial.print(pendingReadingCount);
  Serial.println(")");
}

bool postReadingToBackend(float heartRate, float spo2, float temperature) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!validReading(heartRate, spo2, temperature)) return true;
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + API_TOKEN);
  String body = String("{\"patientId\":\"") + PATIENT_ID + "\",\"heartRate\":" + heartRate + ",\"spo2\":" + spo2 + ",\"temperature\":" + temperature + "}";
  const int responseCode = http.POST(body);
  const bool requestSucceeded = responseCode >= 200 && responseCode < 300;
  Serial.print("HTTP POST ");
  Serial.print(requestSucceeded ? "success: " : "failure: ");
  Serial.print(responseCode);
  Serial.print(" (");
  Serial.print(http.errorToString(responseCode).c_str());
  Serial.println(")");
  http.end();
  return requestSucceeded;
}

void postReading(float heartRate, float spo2, float temperature) {
  const unsigned long timestamp = millis();
  if (!postReadingToBackend(heartRate, spo2, temperature)) {
    bufferReading(heartRate, spo2, temperature, timestamp);
  }
}

void flushBufferedReadings() {
  while (pendingReadingCount > 0) {
    const PendingReading& pending = pendingReadings[pendingReadingHead];
    Serial.print("Flush attempt for buffered reading (pending=");
    Serial.print(pendingReadingCount);
    Serial.println(")");

    if (!postReadingToBackend(pending.heartRate, pending.spo2, pending.temperature)) {
      Serial.println("Buffered reading flush failed; retrying next cycle");
      return;
    }

    Serial.println("Buffered reading flush succeeded");
    pendingReadingHead = (pendingReadingHead + 1) % PENDING_READING_CAPACITY;
    pendingReadingCount--;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  max30102.begin(Wire, I2C_SPEED_FAST);
  Serial.println("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (millis() - lastPost < 5000) return;
  lastPost = millis();
  flushBufferedReadings();
  // Replace these placeholders with MAX30102 algorithm output after sensor calibration.
  float heartRate;
  float spo2;
#if USE_MOCK_SENSORS
  readMockVitals(heartRate, spo2);
#else
  heartRate = 0;
  spo2 = 0;
#endif
  const float temperature = readTemperatureC();
  Serial.print("Reading: heartRate=");
  Serial.print(heartRate);
  Serial.print(", spo2=");
  Serial.print(spo2);
  Serial.print(", temperature=");
  Serial.println(temperature);
  postReading(heartRate, spo2, temperature);
}
