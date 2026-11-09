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

### Window labels

Window labels are assigned from the known latent episode state, never from extracted features or model predictions:

- `stable`: every 12-reading window is `low`.
- `sudden_spike`: the spike starts at reading index 36 and lasts 12 readings. A window is `moderate` only when it contains at least 4 spike readings; otherwise it is `low`. Four readings is enough to represent a meaningful fraction of a 12-reading window while leaving the transition windows low.
- `gradual_deterioration`: drift starts at index 0. Windows are `low` before 12 drift steps, `moderate` from 12 through 35 steps, and `high` from 36 steps onward. These boundaries separate early drift from sustained deterioration using the generator's 60-step episode.
- `recovering`: recovery starts at index 12. A window is `moderate` while it contains at least 4 pre-recovery abnormal readings, and `low` once recovery has progressed beyond that phase.

The original whole-episode labels remain documented above for comparison with the previous live model; newly generated datasets use the per-window rules here.

## Promoted v2 metrics

`synthetic-risk-logreg-v2` was trained on the refined latent-state window labels. On the held-out test episodes it achieved accuracy `0.879592`:

| Class | Precision | Recall | F1 | Support |
| --- | ---: | ---: | ---: | ---: |
| low | 0.896293 | 0.933364 | 0.914453 | 2176 |
| moderate | 0.804902 | 0.750457 | 0.776727 | 1094 |
| high | 0.940063 | 0.916923 | 0.928349 | 650 |

Confusion matrix, rows=true and columns=predicted, label order `[low, moderate, high]`:

```text
[[2031, 145, 0],
 [235, 821, 38],
 [0, 54, 596]]
```

The previous live model reported metrics against episode-level labels, while v2 uses latent-state labels for each 12-reading window. Those two evaluations answer different questions and are not directly comparable as clinical or model-performance measurements.

## Run

From `backend/ai/`:

```powershell
python generate_dataset.py
python train.py

# Candidate artifacts without replacing the live model files:
python generate_dataset.py --out-dir candidate
python train.py --out-dir candidate
```

The generated `dataset.json` and `model.json` are local artifacts. `model.json` records the feature order, class names, fitted scaler parameters, classifier parameters, training date, and held-out test metrics.

## Limitation

All readings are simulated. The resulting metrics demonstrate that the pipeline runs on this synthetic distribution; they are not clinical accuracy claims and must not be used for diagnosis, triage, or patient-care decisions.
