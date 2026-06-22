from __future__ import annotations

import time
from collections import Counter, defaultdict
from threading import RLock
from typing import Any


def _label_key(labels: dict[str, Any] | None) -> tuple[tuple[str, str], ...]:
    if not labels:
        return ()
    return tuple(sorted((str(key), str(value)) for key, value in labels.items()))


def _format_labels(labels: tuple[tuple[str, str], ...]) -> str:
    if not labels:
        return ""
    joined = ",".join(f'{key}="{value.replace(chr(34), "")}"' for key, value in labels)
    return "{" + joined + "}"


class Timer:
    def __init__(self) -> None:
        self.started_at = time.perf_counter()

    @property
    def elapsed(self) -> float:
        return time.perf_counter() - self.started_at


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = RLock()
        self._counters: Counter[tuple[str, tuple[tuple[str, str], ...]]] = Counter()
        self._durations: dict[tuple[str, tuple[tuple[str, str], ...]], list[float]] = defaultdict(list)

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._durations.clear()

    def reset_for_tests(self) -> None:
        self.reset()

    def increment(self, name: str, labels: dict[str, Any] | None = None, value: int = 1) -> None:
        with self._lock:
            self._counters[(name, _label_key(labels))] += value

    def observe_duration(self, name: str, elapsed_seconds: float, labels: dict[str, Any] | None = None) -> None:
        with self._lock:
            self._durations[(name, _label_key(labels))].append(float(elapsed_seconds))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counters = [
                {"name": name, "labels": dict(labels), "value": count}
                for (name, labels), count in sorted(self._counters.items())
            ]
            durations = []
            for (name, labels), values in sorted(self._durations.items()):
                if not values:
                    continue
                sorted_values = sorted(values)
                durations.append(
                    {
                        "name": name,
                        "labels": dict(labels),
                        "count": len(values),
                        "minSeconds": sorted_values[0],
                        "maxSeconds": sorted_values[-1],
                        "avgSeconds": sum(values) / len(values),
                    }
                )
        return {"counters": counters, "durations": durations}

    def render_prometheus(self) -> str:
        lines: list[str] = []
        with self._lock:
            for (name, labels), count in sorted(self._counters.items()):
                lines.append(f"# TYPE {name} counter")
                lines.append(f"{name}{_format_labels(labels)} {count}")
            for (name, labels), values in sorted(self._durations.items()):
                metric_name = f"{name}_duration_seconds"
                lines.append(f"# TYPE {metric_name} summary")
                lines.append(f"{metric_name}_count{_format_labels(labels)} {len(values)}")
                lines.append(f"{metric_name}_sum{_format_labels(labels)} {sum(values)}")
        return "\n".join(lines) + ("\n" if lines else "")


metrics = MetricsRegistry()


def render_prometheus_metrics() -> str:
    return metrics.render_prometheus()


def reset_metrics_for_tests() -> None:
    metrics.reset()
