"""Exercise native storage writers on disposable fixture homes, never in the plugin."""
import importlib.util
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple


def _venv_checkout() -> Path | None:
    venv = Path(sys.executable).parent.parent
    checkout = venv.parent
    if (venv.name == '.venv' and (checkout / 'hermes_constants.py').is_file()
            and (checkout / 'gateway/status.py').is_file()):
        return checkout
    return None


def use_hermes_checkout() -> None:
    """Use the checkout whose .venv/bin/python launched the fixture, if any."""
    if (checkout := _venv_checkout()) is not None:
        # Do not resolve .venv: a pinned checkout can share installed dependencies
        # with a newer one. Its source must take precedence over the editable finder.
        sys.path.insert(0, str(checkout))


def _has_storage_interface() -> bool:
    if (checkout := _venv_checkout()) is not None:
        # An editable finder from the shared venv must not supply capabilities
        # absent from the selected checkout itself.
        return (checkout / 'persistence_assembly.py').is_file()
    return importlib.util.find_spec('persistence_assembly') is not None


def holder_namespace_token() -> str:
    """Stamp synthetic holders without depending on a Hermes private module."""
    if sys.platform != 'linux':
        return ''
    link = os.readlink('/proc/self/ns/pid')
    match = re.fullmatch(r'pid:\[(\d+)\]', link)
    assert match is not None, f'unrecognized PID namespace link: {link!r}'
    return f':pidns={match[1]}'


class StartedAdmission(NamedTuple):
    epoch: int
    admission_id: str
    generation: int


class FixtureStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.persistence = None
        if not _has_storage_interface():
            # The pinned pre-storage-interface host uses these real writers.
            from hermes_state import SessionDB
            self.native = SessionDB(db_path=db_path)
        else:
            from persistence_assembly import open_persistence, profile_scope
            assert db_path.name == 'state.db'
            self.native = self.persistence = open_persistence(profile_scope(home=db_path.parent), eager=True)

    def close(self):
        self.native.close()

    def create_session(self, session_id, source, *, parent_session_id=None):
        if self.persistence is None:
            return self.native.create_session(session_id, source, parent_session_id=parent_session_id)
        from persistence.conversation.sessions import NewSession
        return self.persistence.sessions.create(NewSession(
            session_id=session_id, source=source, parent_session_id=parent_session_id))

    def end_session(self, session_id, reason):
        if self.persistence is None:
            return self.native.end_session(session_id, reason)
        return self.persistence.sessions.end(session_id, reason)

    def try_acquire_session_turn_lease(self, session_id, holder, *, ttl_seconds=300):
        if self.persistence is None:
            return self.native.try_acquire_session_turn_lease(session_id, holder, ttl_seconds=ttl_seconds)
        return self.persistence.coordination.try_acquire_turn_lease(
            session_id=session_id, holder=holder, ttl_seconds=ttl_seconds)

    def release_session_turn_lease(self, session_id, holder):
        if self.persistence is None:
            return self.native.release_session_turn_lease(session_id, holder)
        return self.persistence.coordination.release_turn_lease(session_id=session_id, holder=holder)

    def start_admission(self, session_id: str, text: str) -> StartedAdmission:
        fields = dict(principal_id='human', session_id=session_id, request_id='r1', payload={'text': text})
        if self.persistence is None:
            import hermes_state_runtime as runtime
            epoch = runtime.begin_runtime_epoch(self.native, instance_id='fixture')
            admission = runtime.admit_session_input(self.native, epoch=epoch, **fields)
            claim = runtime.claim_session_input(self.native, epoch=epoch, session_id=session_id)
            assert isinstance(claim, dict) and claim['status'] == 'started'
            assert claim['admission_id'] == admission['admission_id']
            return StartedAdmission(epoch, admission['admission_id'], claim['generation'])
        epoch = self.persistence.runtime.begin_epoch(instance_id='fixture')
        admission, created = self.persistence.admissions.admit(epoch=epoch, **fields)
        claim = self.persistence.admissions.claim(epoch=epoch, session_id=session_id)
        assert created and claim and claim.status == 'started' and claim.generation is not None
        assert claim.admission_id == admission.admission_id
        return StartedAdmission(epoch, admission.admission_id, claim.generation)

    def complete_admission(self, admission: StartedAdmission):
        fields = dict(epoch=admission.epoch, admission_id=admission.admission_id,
                      generation=admission.generation, outcome='completed')
        if self.persistence is None:
            import hermes_state_runtime as runtime
            return runtime.settle_session_input(self.native, **fields)
        return self.persistence.admissions.settle(**fields)
