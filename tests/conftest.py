"""Add prototype root to sys.path so tests can import serve and validator."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
