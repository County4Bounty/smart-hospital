# Offline Synthetic Risk Pipeline

This directory contains an offline machine-learning pipeline for experimenting with patient-vitals risk classification.

## Pipeline

1. `generate_dataset.py` creates 400 deterministic **synthetic** patient episodes with 60 readings per episode at five-second intervals.
2. Each episode is converted into sliding windows of the last 12 readings.
3. Every window has 10 features: mean, standard deviation, and linear slope for heart rate, SpO2, and temperature, plus the number of readings outside the alert thresholds.
4. Episodes, rather than individual windows, are split into train and test sets to prevent episode leakage.
5. `train.py` standardizes the features, fits a multinomial logistic-regression classifier, prints held-out metrics, and exports `model.json`.

The alert thresholds used by feature extraction are heart rate above 120, SpO2 below 92, and temperature above 38. The normal and abnormal profile ranges mirror `backend/scripts/mock-multi-patient.js`.

## Labels

- `stable` -> `low`: normal vitals with random noise.
- `recovering` -> `low`: starts abnormal and trends back toward normal.
- `sudden_spike` -> `moderate`: stable readings with a short abrupt abnormal burst.
- `gradual_deterioration` -> `high`: heart rate drifts upward, SpO2 drifts downward, and temperature rises gradually.

## Run

From `backend/ai/`:

```powershell
python generate_dataset.py
python train.py
```

The generated `dataset.json` and `model.json` are local artifacts. `model.json` records the feature order, class names, fitted scaler parameters, classifier parameters, training date, and held-out test metrics.

## Limitation

All readings are simulated. The resulting metrics demonstrate that the pipeline runs on this synthetic distribution; they are not clinical accuracy claims and must not be used for diagnosis, triage, or patient-care decisions.
