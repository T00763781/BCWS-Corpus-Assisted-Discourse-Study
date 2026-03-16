from __future__ import annotations

from collections import Counter


def summarize_information_gaps(texts: list[str]) -> dict:
    counter = Counter()
    for text in texts:
        lower = text.lower()
        if "ask" in lower or "whether" in lower or "?" in lower:
            counter["question_or_uncertainty"] += 1
        if "screenshot" in lower or "rumor" in lower:
            counter["screenshot_or_rumor"] += 1
        if "update" in lower or "official" in lower:
            counter["official_update_reference"] += 1
    return dict(counter)
