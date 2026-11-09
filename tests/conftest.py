"""Resolve the installed Hermes source for independent native-contract tests.

The editable install exposes public modules through a finder; sibling native
modules also need the source directory on sys.path. Do not depend on another
collected test importing it first.
"""
import importlib.util
import os
from pathlib import Path
import sys
import pytest
import psutil

spec = importlib.util.find_spec('hermes_state')
if spec is None or spec.origin is None:
    raise RuntimeError('Run tests with an existing Hermes Python environment')
source_root = str(Path(spec.origin).resolve().parent)
if source_root not in sys.path:
    sys.path.insert(0, source_root)


@pytest.fixture(autouse=True)
def forbid_real_process_signals(monkeypatch):
    """Fixtures that exercise POSIX probing must install their own fake kill."""
    monkeypatch.setattr(os, 'kill', lambda *args: pytest.fail('unmocked os.kill'))
    monkeypatch.setattr(psutil, 'pid_exists', lambda *args: pytest.fail('unmocked psutil.pid_exists'))
    monkeypatch.setattr(psutil, 'Process', lambda *args: pytest.fail('unmocked psutil.Process'))
