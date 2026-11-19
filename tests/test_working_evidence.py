"""Status exposes recency provenance; Desktop validates live execution separately."""
import sqlite3
import time
from types import SimpleNamespace

from test_shared_host_idle import fleet, rows


def test_recently_ended_session_does_not_override_fresh_zero_host(fleet):
    _, _, client, root = fleet
    now = time.time()
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                   ('ended', 'desktop', now, now, 0, 0, 0, 0))
    result = rows(client)
    assert result['alpha']['state'] == 'idle'
    assert result['alpha']['busy'] is False


def test_open_recent_session_is_explicitly_marked_as_recency(fleet):
    _, runtime, client, root = fleet
    runtime['active_agents'] = 1
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                   ('completed-turn', 'desktop', time.time(), None, 0, 0, 0, 0))
    result = rows(client)['alpha']
    # Keep the legacy API fields for compatibility. They must carry provenance
    # so Desktop does not treat them as positive execution evidence.
    assert result['status_observation'] == 'recent_session_activity'
    assert result['active_sessions'] == 1


def test_old_activity_does_not_invent_execution_evidence(fleet):
    _, runtime, client, root = fleet
    runtime['active_agents'] = 1
    now = time.time()
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                   ('long-tool', 'desktop', now - 600, None, 0, 0, 0, 0))
    result = rows(client)['alpha']
    # A long tool's positive working signal is tested through the public
    # session.active_list consumer, not a synthetic private lease schema.
    assert result['state'] == 'online_unobserved'
    assert result['busy'] is None
    assert result['active_sessions'] == 0


def test_shared_counter_observation_is_independent_of_recency(fleet, monkeypatch):
    collector, runtime, client, root = fleet
    now = time.time()
    monkeypatch.setattr(collector, 'time', SimpleNamespace(time=lambda: now))
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                   ('open', 'desktop', now - 90, None, 0, 0, 0, 0))
    runtime['active_agents'] = 1
    inside = rows(client)['alpha']
    assert (inside['state'], inside['status_observation']) == ('working', 'recent_session_activity')
    assert inside.get('shared_gateway_observation') == 'positive'
    runtime['active_agents'] = 0
    zero = rows(client)['alpha']
    assert zero['status_observation'] == 'recent_session_activity'  # legacy fields unchanged
    assert zero.get('shared_gateway_observation') == 'zero'
    assert zero['last_session_activity'] == now - 90
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('INSERT INTO session_turn_leases VALUES (?,?)', ('open', now + 60))
    assert rows(client)['alpha'].get('shared_gateway_observation') != 'zero', 'a contradictory turn blocks the zero fallback'
    now += 0.01
    assert rows(client)['alpha']['state'] != 'idle', 'the recency cutoff must not override a known turn'
    with sqlite3.connect(root / 'profiles/alpha/state.db') as db:
        db.execute('DELETE FROM session_turn_leases')
    assert rows(client)['alpha']['shared_gateway_observation'] == 'zero'
    assert rows(client)['alpha']['state'] == 'idle'
    runtime['start_time'] = 1
    assert rows(client)['alpha'].get('shared_gateway_observation') is None


def test_recently_ended_child_does_not_activate_delegation_route(fleet):
    _, _, client, root = fleet
    now = time.time()
    with sqlite3.connect(root / 'state.db') as db:
        db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)',
                   ('child', 'subagent', now, now, 0, 0, 0, 0))
        db.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?)',
                   ('running', 'pending', now, None, None, None, '{"profile":"alpha"}'))
    assert rows(client)['alpha']['state'] == 'idle'
