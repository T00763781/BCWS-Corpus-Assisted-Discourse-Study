from open_fireside_api.analytics.gap_detection import summarize_information_gaps


def test_gap_detection_smoke():
    summary = summarize_information_gaps([
        "People are asking whether alerts will widen?",
        "A screenshot rumor is circulating.",
        "Official update expected soon.",
    ])
    assert summary["question_or_uncertainty"] == 1
    assert summary["screenshot_or_rumor"] == 1
    assert summary["official_update_reference"] == 1
