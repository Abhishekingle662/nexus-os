from queue import Queue

# Module-level singleton — agents push events here; main.py drains and broadcasts them.
live_events: Queue = Queue()
