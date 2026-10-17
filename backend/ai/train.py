"""Train and export the synthetic patient-risk classifier."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.preprocessing import StandardScaler

from generate_dataset import PATIENT_PROFILES, SEED, extract_features, generate_episode


BASE_DIR = Path(__file__).parent
DATASET_PATH = BASE_DIR / "dataset.json"
MODEL_PATH = BASE_DIR / "model.json"
MODEL_VERSION = "synthetic-risk-logreg-v1"
PARITY_PATH = BASE_DIR / "parity_samples.json"


def load_dataset() -> tuple[dict, list[dict], list[dict]]:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    train_samples = dataset["train"]
    test_samples = dataset["test"]
    train_episodes = {sample["episodeId"] for sample in train_samples}
    test_episodes = {sample["episodeId"] for sample in test_samples}
    overlap = train_episodes & test_episodes
    if overlap:
        raise ValueError(f"Episode leakage detected between train and test: {sorted(overlap)}")
    return dataset, train_samples, test_samples


def build_parity_samples(scaler: StandardScaler, classifier: LogisticRegression) -> list[dict]:
    scenarios_and_ends = [
        ("stable", [11, 30, 59]),
        ("gradual_deterioration", [11, 35, 59]),
        ("sudden_spike", [11, 41, 59]),
        ("recovering", [11, 30, 59]),
    ]
    import random

    rng = random.Random(SEED)
    parity_samples = []
    for episode_number, (scenario, end_indexes) in enumerate(scenarios_and_ends):
        readings = generate_episode(scenario, PATIENT_PROFILES[episode_number % len(PATIENT_PROFILES)], rng)
        for end_index in end_indexes:
            window = readings[end_index - 11 : end_index + 1]
            features = extract_features(window)
            probabilities = classifier.predict_proba(scaler.transform([features]))[0]
            parity_samples.append({
                "scenario": scenario,
                "endReadingIndex": end_index,
                "readings": window,
                "probabilities": {
                    class_name: float(probabilities[index])
                    for index, class_name in enumerate(classifier.classes_)
                },
            })
    return parity_samples


def main() -> None:
    dataset, train_samples, test_samples = load_dataset()
    feature_names = dataset["metadata"]["featureNames"]
    x_train = [sample["features"] for sample in train_samples]
    y_train = [sample["label"] for sample in train_samples]
    x_test = [sample["features"] for sample in test_samples]
    y_test = [sample["label"] for sample in test_samples]

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    classifier = LogisticRegression(
        solver="lbfgs",
        max_iter=2000,
        random_state=dataset["metadata"]["seed"],
    )
    classifier.fit(x_train_scaled, y_train)
    predictions = classifier.predict(x_test_scaled)
    class_names = list(classifier.classes_)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_test,
        predictions,
        labels=class_names,
        zero_division=0,
    )
    accuracy = accuracy_score(y_test, predictions)
    matrix = confusion_matrix(y_test, predictions, labels=class_names)
    per_class = {
        class_name: {
            "precision": float(precision[index]),
            "recall": float(recall[index]),
            "f1": float(f1[index]),
            "support": int(support[index]),
        }
        for index, class_name in enumerate(class_names)
    }
    metrics = {
        "accuracy": float(accuracy),
        "perClass": per_class,
        "confusionMatrix": matrix.tolist(),
        "confusionMatrixLabels": class_names,
        "testWindowCount": len(y_test),
        "testEpisodeCount": len({sample["episodeId"] for sample in test_samples}),
    }

    print(f"Accuracy: {accuracy:.4f}")
    print("Per-class precision / recall / F1:")
    for class_name in class_names:
        scores = per_class[class_name]
        print(
            f"  {class_name}: precision={scores['precision']:.4f} "
            f"recall={scores['recall']:.4f} f1={scores['f1']:.4f} "
            f"support={scores['support']}"
        )
    print("Confusion matrix (rows=true, columns=predicted):")
    print(matrix)

    exported_model = {
        "modelVersion": MODEL_VERSION,
        "trainingDate": datetime.now(timezone.utc).date().isoformat(),
        "datasetDescription": dataset["metadata"]["description"],
        "featureNames": feature_names,
        "classNames": class_names,
        "scalerMeans": scaler.mean_.tolist(),
        "scalerScales": scaler.scale_.tolist(),
        "coefficients": classifier.coef_.tolist(),
        "intercepts": classifier.intercept_.tolist(),
        "testMetrics": metrics,
    }
    MODEL_PATH.write_text(json.dumps(exported_model, indent=2), encoding="utf-8")
    print(f"Wrote model to {MODEL_PATH}")

    parity_samples = {
        "modelVersion": MODEL_VERSION,
        "classNames": class_names,
        "samples": build_parity_samples(scaler, classifier),
    }
    PARITY_PATH.write_text(json.dumps(parity_samples, indent=2), encoding="utf-8")
    print(f"Wrote {len(parity_samples['samples'])} parity samples to {PARITY_PATH}")


if __name__ == "__main__":
    main()
