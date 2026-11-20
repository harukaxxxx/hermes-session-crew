"""Common safeguards for controlled Python tests."""
import os
import pytest
import psutil

from hermes_fixture_store import use_hermes_checkout

use_hermes_checkout()


@pytest.fixture(autouse=True)
def forbid_real_process_signals(monkeypatch):
    """Fixtures that exercise POSIX probing must install their own fake kill."""
    monkeypatch.setattr(os, 'kill', lambda *args: pytest.fail('unmocked os.kill'))
    monkeypatch.setattr(psutil, 'pid_exists', lambda *args: pytest.fail('unmocked psutil.pid_exists'))
    monkeypatch.setattr(psutil, 'Process', lambda *args: pytest.fail('unmocked psutil.Process'))
