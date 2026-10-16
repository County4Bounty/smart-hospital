"""Generate deterministic synthetic patient episodes and sliding-window features."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

SEED = 20241015
EPISODE_COUNT = 400
READINGS_PER_EPISODE = 60
READING_INTERVAL_SECONDS = 5
WINDOW_SIZE = 12
TEST_EPISODE_FRACTION = 0.2

# These ranges and abnormal values mirror backend/scripts/mock-multi-patient.js.
PATIENT_PROFILES = [
    {
        "normal": {"heartRate": (70, 82), "spo2": (96, 99), "temperature": (36.6, 37.1)},
        "abnormal": {"heartRate": 145, "spo2": 87, "temperature": 38.6},
    },
    {
        "normal": {"heartRate": (65, 76), "spo2": (97, 99), "temperature": (36.5, 37.0)},
        "abnormal": {"heartRate": 132, "spo2": 89, "temperature": 38.2},
    },
    {
        "normal": {"heartRate": (72, 85), "spo2": (95, 98), "temperature": (36.7, 37.3)},
        "abnormal": {"heartRate": 128, "spo2": 90, "temperature": 38.0},
    },
]

SCENARIO_TO_RISK = {
    "stable": "low",
    "recovering": "low",
    "sudden_spike": "moderate",
    "gradual_deterioration": "high",
}
FEATURE_NAMES = [
    "heartRate_mean",
    "heartRate_std",
    "heartRate_slope",
    "spo2_mean",
    "spo2_std",
    "spo2_slope",
    "temperature_mean",
    "temperature_std",
    "temperature_slope",
    "outside_threshold_count",
]


def sample_normal(profile: dict, rng: random.Random) -> dict[str, float]:
    values = {}
    for metric, bounds in profile["normal"].items():
        midpoint = (bounds[0] + bounds[1]) / 2
        spread = (bounds[1] - bounds[0]) / 5
        values[metric] = rng.gauss(midpoint, spread)
    return values


def interpolate(start: float, end: float, fraction: float) -> float:
    return start + (end - start) * fraction


def generate_episode(scenario: str, profile: dict, rng: random.Random) -> list[dict[str, float | int]]:
    readings = []
    normal_start = sample_normal(profile, rng)
    normal_end = sample_normal(profile, rng)
    abnormal = profile["abnormal"]

    for step in range(READINGS_PER_EPISODE):
        normal = sample_normal(profile, rng)
        if scenario == "stable":
            values = normal
        elif scenario == "gradual_deterioration":
            values = {
                "heartRate": normal["heartRate"] + 0.5 * step,
                "spo2": normal["spo2"] - 0.15 * step,
                "temperature": normal["temperature"] + 0.02 * step,
            }
        elif scenario == "sudden_spike":
            in_burst = 36 <= step < 48
            values = dict(abnormal) if in_burst else normal
        elif scenario == "recovering":
            recovery_start = 12
            if step < recovery_start:
                values = dict(abnormal)
            else:
                fraction = (step - recovery_start) / (READINGS_PER_EPISODE - recovery_start - 1)
                values = {
                    metric: interpolate(abnormal[metric], normal_end[metric], fraction) + rng.gauss(0, 0.08)
                    for metric in abnormal
                }
        else:
            raise ValueError(f"Unknown scenario: {scenario}")

        readings.append(
            {
                "timestampOffsetSeconds": step * READING_INTERVAL_SECONDS,
                "heartRate": round(values["heartRate"], 3),
                "spo2": round(values["spo2"], 3),
                "temperature": round(values["temperature"], 3),
            }
        )

    return readings


def linear_slope(values: list[float]) -> float:
    count = len(values)
    mean_x = (count - 1) / 2
    mean_y = sum(values) / count
    denominator = sum((index - mean_x) ** 2 for index in range(count))
    numerator = sum((index - mean_x) * (value - mean_y) for index, value in enumerate(values))
    return numerator / denominator if denominator else 0.0


def extract_features(window: list[dict[str, float | int]]) -> list[float]:
    features = []
    for metric in ("heartRate", "spo2", "temperature"):
        values = [float(reading[metric]) for reading in window]
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        features.extend([mean, math.sqrt(variance), linear_slope(values)])

    outside_count = sum(
        reading["heartRate"] > 120
        or reading["spo2"] < 92
        or reading["temperature"] > 38
        for reading in window
    )
    features.append(float(outside_count))
    return [round(value, 6) for value in features]


def episode_samples(episode_id: str, scenario: str, readings: list[dict[str, float | int]]) -> list[dict]:
    label = SCENARIO_TO_RISK[scenario]
    samples = []
    for end_index in range(WINDOW_SIZE - 1, len(readings)):
        window = readings[end_index - WINDOW_SIZE + 1 : end_index + 1]
        samples.append(
            {
                "episodeId": episode_id,
                "scenario": scenario,
                "label": label,
                "endReadingIndex": end_index,
                "features": extract_features(window),
            }
        )
    return samples


def main() -> None:
    rng = random.Random(SEED)
    scenarios = list(SCENARIO_TO_RISK)
    episodes = []
    for episode_number in range(EPISODE_COUNT):
        scenario = scenarios[episode_number % len(scenarios)]
        profile = PATIENT_PROFILES[episode_number % len(PATIENT_PROFILES)]
        episode_id = f"episode-{episode_number + 1:04d}"
        episodes.append(
            {
                "episodeId": episode_id,
                "scenario": scenario,
                "readings": generate_episode(scenario, profile, rng),
            }
        )

    rng.shuffle(episodes)
    test_episode_count = round(len(episodes) * TEST_EPISODE_FRACTION)
    test_episodes = episodes[:test_episode_count]
    train_episodes = episodes[test_episode_count:]

    dataset = {
        "metadata": {
            "seed": SEED,
            "episodeCount": len(episodes),
            "readingsPerEpisode": READINGS_PER_EPISODE,
            "readingIntervalSeconds": READING_INTERVAL_SECONDS,
            "windowSize": WINDOW_SIZE,
            "featureNames": FEATURE_NAMES,
            "scenarioToRisk": SCENARIO_TO_RISK,
            "description": "Synthetic patient episodes for offline ML pipeline development; not clinical data.",
        },
        "train": [
            sample
            for episode in train_episodes
            for sample in episode_samples(episode["episodeId"], episode["scenario"], episode["readings"])
        ],
        "test": [
            sample
            for episode in test_episodes
            for sample in episode_samples(episode["episodeId"], episode["scenario"], episode["readings"])
        ],
    }

    output_path = Path(__file__).with_name("dataset.json")
    output_path.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    print(f"Generated {len(episodes)} episodes: {len(train_episodes)} train, {len(test_episodes)} test")
    print(f"Wrote {len(dataset['train'])} train windows and {len(dataset['test'])} test windows to {output_path}")


if __name__ == "__main__":
    main()
