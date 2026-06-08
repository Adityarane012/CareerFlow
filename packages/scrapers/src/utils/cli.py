import argparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Job Agent — Aggregate job listings from Naukri, RemoteOK, and Wellfound."
    )
    parser.add_argument(
        "title",
        type=str,
        nargs="?",
        default=None,
        help="Job title or search query (e.g. 'data scientist')",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Output CSV file path (default: generated dynamically using the query and timestamp)",
    )
    parser.add_argument(
        "--source",
        "-s",
        type=str,
        choices=["naukri", "remoteok", "wellfound", "all"],
        default="all",
        help="Source platform to search (choices: naukri, remoteok, wellfound, all; default: all)",
    )
    return parser.parse_args()
