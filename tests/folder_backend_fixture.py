"""In-process folder route tests. All data are synthetic; no process probes."""
import os
import sys
from pathlib import Path
import tempfile
import importlib.util
import unittest

# Isolate HOME before importing any application or third-party modules.
_fixture_home = tempfile.TemporaryDirectory(dir=os.environ['RAIL_TEST_SCRATCH'])
os.environ['HOME'] = _fixture_home.name
os.environ['HERMES_HOME'] = str(Path(_fixture_home.name) / '.hermes')
Path(os.environ['HERMES_HOME']).mkdir()
# Install before importing FastAPI, gateway, or the candidate module.
def forbidden(*args, **kwargs):
    raise AssertionError('real process probe forbidden')
os.kill = forbidden
import psutil
psutil.Process = forbidden
psutil.pid_exists = forbidden

from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
sys.path.insert(0, os.environ['HERMES_CHECKOUT'])
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rail_api_fixture', ROOT / 'dashboard' / 'plugin_api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class FolderAPI(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ['RAIL_TEST_SCRATCH'])
        self.base = Path(self.temp.name)
        self.root = self.base / '.hermes'
        self.root.mkdir()
        self.old_home = os.environ.get('HERMES_HOME')
        os.environ['HERMES_HOME'] = str(self.root)
        api.get_hermes_home = lambda: self.root
        self.app = FastAPI()
        self.app.include_router(api.router)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        if self.old_home is None: os.environ.pop('HERMES_HOME', None)
        else: os.environ['HERMES_HOME'] = self.old_home
        self.temp.cleanup()

    def post(self, **data): return self.client.post('/folders', json=data)

    def test_idea_locked_directory_rejects_without_blocking_event_loop(self):
        import asyncio, fcntl, threading
        import httpx
        project = self.base / 'locked'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'],
                'project_id': 'fixture-id', 'owner': 'fixture-owner', 'content': 'locked idea'}
        fd = os.open(project, os.O_RDONLY | os.O_DIRECTORY)
        fcntl.flock(fd, fcntl.LOCK_EX)
        released = threading.Event()
        def release():
            released.set()
            fcntl.flock(fd, fcntl.LOCK_UN)
        timer = threading.Timer(1.0, release)
        timer.start()
        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test') as client:
                response = await client.post('/folders/idea', json=body)
                self.assertFalse(released.is_set(), 'lock wait blocked request until release')
                self.assertEqual(response.status_code, 409, response.text)
                self.assertIn('retry', response.text.lower())
                self.assertFalse((project / 'IDEA.md').exists())
                timer.cancel()
                release()
                response = await client.post('/folders/idea', json=body)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual((project / 'IDEA.md').read_text(), 'locked idea')
        try:
            asyncio.run(exercise())
        finally:
            timer.cancel()
            timer.join()
            if not released.is_set(): release()
            os.close(fd)

    def test_idea_saved_exactly_and_read_back(self):
        project = self.base / 'project'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        response = self.client.post('/folders/idea', json={'path': str(project),
            'root_id': listing['root_id'], 'directory_id': listing['directory_id'],
            'runtime_id': listing['runtime_id'], 'project_id':'fixture-id', 'owner':'fixture-owner', 'content': '  synthetic idea\n'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'saved')
        self.assertEqual((project / 'IDEA.md').read_bytes(), b'  synthetic idea\n')

    def test_slow_folder_io_does_not_block_event_loop(self):
        import asyncio, threading
        from unittest.mock import patch
        import httpx
        project = self.base / 'slow'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'],
                'project_id': 'fixture-id', 'owner': 'fixture-owner', 'content': 'idea'}
        entered, release = threading.Event(), threading.Event()
        original = api._folder_operation
        def slow(request):
            entered.set()
            release.wait(2)
            return original(request)
        async def exercise():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test') as client:
                task = asyncio.create_task(client.post('/folders/idea', json=body))
                await asyncio.sleep(0.1)
                self.assertTrue(entered.is_set())
                self.assertFalse(task.done(), 'slow operation should still be pending while loop runs')
                release.set()
                self.assertEqual((await task).status_code, 200)
        try:
            with patch.object(api, '_folder_operation', side_effect=slow): asyncio.run(exercise())
        finally:
            release.set()

    def test_idea_idempotent_and_never_overwrites(self):
        project = self.base / 'project'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'], 'project_id':'fixture-id', 'owner':'fixture-owner', 'content': 'original'}
        self.assertEqual(self.client.post('/folders/idea', json=body).status_code, 200)
        self.assertEqual(self.client.post('/folders/idea', json=body).status_code, 200)
        self.assertEqual(self.client.post('/folders/idea', json={**body, 'content': 'changed'}).status_code, 409)
        self.assertEqual((project / 'IDEA.md').read_text(), 'original')

    def test_idea_refuses_changed_identities_invalid_content_and_links(self):
        project = self.base / 'project'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'], 'project_id':'fixture-id', 'owner':'fixture-owner', 'content': 'content'}
        for key in ('root_id', 'directory_id', 'runtime_id'):
            self.assertEqual(self.client.post('/folders/idea', json={**body, key: 'wrong'}).status_code, 409)
        for content in ('  \n', 'x' * 65537):
            self.assertEqual(self.client.post('/folders/idea', json={**body, 'content': content}).status_code, 400)
        import json
        self.assertEqual(self.client.post('/folders/idea', content=json.dumps({**body, 'content':'\ud800'}).encode()).status_code, 400)
        self.assertEqual(self.client.post('/folders/idea', content=b'\xff', headers={'content-type':'application/json'}).status_code, 400)
        self.assertEqual(self.client.post('/folders/idea', content=b'x' * 262145).status_code, 413)
        target = self.base / 'other'
        target.write_text('private fixture')
        (project / 'IDEA.md').symlink_to(target)
        self.assertNotEqual(self.client.post('/folders/idea', json=body).status_code, 200)
        (project / 'IDEA.md').unlink()
        os.link(target, project / 'IDEA.md')
        self.assertNotEqual(self.client.post('/folders/idea', json=body).status_code, 200)
        self.assertEqual(target.read_text(), 'private fixture')
        (project / 'IDEA.md').unlink()
        project.rename(self.base / 'old-project')
        project.mkdir()
        self.assertEqual(self.client.post('/folders/idea', json=body).status_code, 409)
        self.assertFalse((project / 'IDEA.md').exists())

    def test_idea_protected_and_traversal_refused(self):
        protected = self.base / '.ssh'
        protected.mkdir()
        listing = self.post(path=str(protected)).json()
        body = {'path': str(protected), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'], 'project_id':'fixture-id', 'owner':'fixture-owner', 'content': 'content'}
        self.assertEqual(self.client.post('/folders/idea', json=body).status_code, 403)
        self.assertEqual(self.client.post('/folders/idea', json={**body, 'path':str(protected)+'/../escape'}).status_code, 400)
        root = self.post().json()
        self.assertEqual(self.client.post('/folders/idea', json={**body, 'path':str(self.root), 'root_id':root['root_id'], 'directory_id':root['directory_id'], 'runtime_id':root['runtime_id']}).status_code, 403)

    def test_idea_parent_swap_is_not_confirmed_and_not_redirected(self):
        from unittest.mock import patch
        project = self.base / 'project'
        project.mkdir()
        replacement = self.base / 'replacement'
        replacement.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'], 'project_id':'fixture-id', 'owner':'fixture-owner', 'content': 'fixture'}
        real_open = os.open
        moved = self.base / 'moved'
        def swapping_open(name, flags, *args, **kwargs):
            if name == 'IDEA.md' and flags & os.O_CREAT:
                project.rename(moved)
                project.symlink_to(replacement, target_is_directory=True)
            return real_open(name, flags, *args, **kwargs)
        with patch.object(api.os, 'open', side_effect=swapping_open):
            response = self.client.post('/folders/idea', json=body)
        self.assertNotEqual(response.status_code, 200)
        self.assertFalse((replacement / 'IDEA.md').exists())
        self.assertEqual((moved / 'IDEA.md').read_text(), 'fixture')

    def test_idea_concurrent_attempts_do_not_truncate_or_report_different_content_saved(self):
        from concurrent.futures import ThreadPoolExecutor
        project = self.base / 'project'
        project.mkdir()
        listing = self.post(path=str(project)).json()
        body = {'path': str(project), 'root_id': listing['root_id'],
                'directory_id': listing['directory_id'], 'runtime_id': listing['runtime_id'],
                'project_id':'fixture-id', 'owner':'fixture-owner'}
        contents = ['a' * 60000, 'b' * 60000]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda text: self.client.post('/folders/idea', json={**body, 'content':text}), contents))
        self.assertEqual(sorted(r.status_code for r in results), [200, 409])
        self.assertEqual((project / 'IDEA.md').read_text(), contents[[r.status_code for r in results].index(200)])

    def test_explicit_external_directory_is_browsable(self):
        projects = self.base / 'Documents' / 'Projects'
        projects.mkdir(parents=True)
        (projects / 'Example').mkdir()
        response = self.post(path=str(projects))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['path'], str(projects))
        self.assertEqual(response.json()['directories'], ['Example'])

    def test_create_in_external_directory(self):
        projects = self.base / 'Documents' / 'Projects'
        projects.mkdir(parents=True)
        listing = self.post(path=str(projects)).json()
        response = self.client.post('/folders/mkdir', json={
            'path': str(projects), 'name': 'Example',
            'root_id': listing['root_id'], 'parent_id': listing['directory_id'],
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['path'], str(projects / 'Example'))
        self.assertTrue((projects / 'Example').is_dir())

    def test_explicit_path_validation_and_denied(self):
        for path in ('relative', '//', '/a/../b', '/a/./b', '/a//b', '/a/', '/a\\b', '/a\x00b'):
            self.assertEqual(self.post(path=path).status_code, 400, repr(path))
        self.assertEqual(self.post(path=str(self.root), parts=['x']).status_code, 400)
        denied = self.base / 'denied'
        denied.mkdir(mode=0o000)
        try:
            if os.geteuid() != 0:
                self.assertEqual(self.post(path=str(denied)).status_code, 403)
        finally:
            denied.chmod(0o700)
        link = self.base / 'link'
        link.symlink_to(self.root, target_is_directory=True)
        self.assertEqual(self.post(path=str(link)).status_code, 403)

    def test_mkdir_is_bounded_non_overwriting_and_identity_checked(self):
        listing = self.post().json()
        request = {'parts': [], 'name': '新資料夾', 'root_id': listing['root_id'], 'parent_id': listing['directory_id']}
        result = self.client.post('/folders/mkdir', json=request)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['name'], '新資料夾')
        self.assertTrue((self.root / '新資料夾').is_dir())
        self.assertEqual(self.client.post('/folders/mkdir', json=request).status_code, 409)
        for name in ('..', '.', '', 'a/b', 'a\\b', '\x00'):
            self.assertEqual(self.client.post('/folders/mkdir', json={**request, 'name': name}).status_code, 400)
        self.assertEqual(self.client.post('/folders/mkdir', json={**request, 'name': 'badroot', 'root_id': 'stale'}).status_code, 409)
        self.assertEqual(self.client.post('/folders/mkdir', json={**request, 'name': 'badparent', 'parent_id': 'stale'}).status_code, 409)
        self.assertFalse((self.root / 'badroot').exists())
        self.assertFalse((self.root / 'badparent').exists())

    def test_mkdir_refuses_symlink_and_invalid_surrogate(self):
        outside = self.base / 'outside'
        outside.mkdir()
        (self.root / 'link').symlink_to(outside, target_is_directory=True)
        root = self.post().json()
        body = {'parts': ['link'], 'name': 'escape', 'root_id': root['root_id'], 'parent_id': root['directory_id']}
        self.assertEqual(self.client.post('/folders/mkdir', json=body).status_code, 403)
        self.assertFalse((outside / 'escape').exists())
        self.assertFalse(api._folder_component('\ud800'))

    def test_mkdir_uses_open_parent_if_path_replaced(self):
        from unittest.mock import patch
        parent = self.root / 'parent'
        parent.mkdir()
        listed = self.post(parts=['parent']).json()
        replacement = self.base / 'replacement'
        replacement.mkdir()
        moved = self.root / 'moved'
        real_mkdir = os.mkdir
        def swap(name, *args, **kwargs):
            if name == 'child' and kwargs.get('dir_fd') is not None:
                parent.rename(moved)
                parent.symlink_to(replacement, target_is_directory=True)
            return real_mkdir(name, *args, **kwargs)
        with patch.object(api.os, 'mkdir', side_effect=swap):
            response = self.client.post('/folders/mkdir', json={'parts': ['parent'], 'name': 'child', 'root_id': listed['root_id'], 'parent_id': listed['directory_id']})
        self.assertNotEqual(response.status_code, 200, response.text)
        self.assertTrue((moved / 'child').is_dir())
        self.assertFalse((replacement / 'child').exists())

    def test_mkdir_moved_parent_reports_unknown_without_root_containment_claim(self):
        from unittest.mock import patch
        parent = self.root / 'parent'
        parent.mkdir()
        listed = self.post(parts=['parent']).json()
        moved = self.base / 'moved-outside'
        real_mkdir = os.mkdir
        def swap(name, *args, **kwargs):
            if name == 'child' and kwargs.get('dir_fd') is not None:
                parent.rename(moved)
            return real_mkdir(name, *args, **kwargs)
        with patch.object(api.os, 'mkdir', side_effect=swap):
            response = self.client.post('/folders/mkdir', json={'parts': ['parent'], 'name': 'child', 'root_id': listed['root_id'], 'parent_id': listed['directory_id']})
        self.assertTrue((moved / 'child').is_dir())
        self.assertNotEqual(response.status_code, 200, response.text)

    def test_folder_only_pagination_navigation_and_symlinks(self):
        for name in ['z', 'a', '.hidden', '中', 'B']:
            (self.root / name).mkdir()
        (self.root / 'a' / 'nested').mkdir()
        (self.root / '.env').write_text('synthetic secret not read')
        (self.root / 'linked').symlink_to(self.base, target_is_directory=True)
        cursor = None
        seen = []
        while True:
            r = self.post(limit=2, after=cursor)
            self.assertEqual(r.status_code, 200, r.text)
            data = r.json()
            self.assertEqual(data['scope'], 'gateway-hermes-root')
            self.assertEqual(data['root'], str(self.root))
            seen += data['directories']
            cursor = data['next_after']
            if cursor is None: break
        self.assertEqual(seen, sorted(['z','a','.hidden','中','B']))
        self.assertEqual(self.post(parts=['a']).json()['directories'], ['nested'])
        self.assertEqual(self.post(parts=['linked']).status_code, 403)
        self.assertEqual(self.post(parts=['missing']).status_code, 404)
        denied = self.root / 'denied'
        denied.mkdir(mode=0o000)
        try:
            if os.geteuid() != 0:
                self.assertEqual(self.post(parts=['denied']).status_code, 403)
        finally:
            denied.chmod(0o700)
        for value in ['..', '.', '/tmp', 'a/b', 'a\\b', '', '\u0000']:
            self.assertEqual(self.post(parts=[value]).status_code, 400, repr(value))
        self.assertEqual(self.post(limit=101).status_code, 422)
        self.assertEqual(self.post(path='/outside/../other').status_code, 400)
        self.assertEqual(self.post(limit=True).status_code, 422)
        self.assertEqual(self.post(parts=['x']*65).status_code, 422)

    def test_root_ancestor_symlink_cannot_bypass_home_rejection(self):
        from unittest.mock import patch
        target = self.base / 'synthetic-home'
        target.mkdir()
        (target / 'private').mkdir()
        link = self.base / 'redirect'
        link.symlink_to(self.base, target_is_directory=True)
        configured = link / target.name
        os.environ['HERMES_HOME'] = str(configured)
        api.get_hermes_home = lambda: target
        with patch.object(api.Path, 'home', return_value=target):
            self.assertEqual(self.post().status_code, 403)

    def test_root_ancestor_symlink_is_refused_even_for_non_home(self):
        custom = self.base / 'custom'
        custom.mkdir()
        link = self.base / 'redirect'
        link.symlink_to(self.base, target_is_directory=True)
        os.environ['HERMES_HOME'] = str(link / 'custom')
        api.get_hermes_home = lambda: custom
        self.assertEqual(self.post().status_code, 403)

    def test_root_replacement_after_open_does_not_redirect_listing(self):
        from unittest.mock import patch
        (self.root / 'original').mkdir()
        replacement = self.base / 'replacement'
        replacement.mkdir()
        (replacement / 'private').mkdir()
        moved = self.base / 'moved'
        real_open = os.open
        swapped = False
        def swapping_open(path, flags, *args, **kwargs):
            nonlocal swapped
            fd = real_open(path, flags, *args, **kwargs)
            if path == self.root.name and kwargs.get('dir_fd') is not None and not swapped:
                swapped = True
                self.root.rename(moved)
                self.root.symlink_to(replacement, target_is_directory=True)
            return fd
        api.get_hermes_home = lambda: replacement
        with patch.object(api.os, 'open', side_effect=swapping_open):
            response = self.post()
        self.assertTrue(swapped)
        self.assertIn(response.status_code, (200, 403), response.text)
        if response.status_code == 200:
            self.assertEqual(response.json()['directories'], ['original'])

    def test_root_resolution_and_access(self):
        custom = self.base / 'custom'
        (custom / 'profiles' / 'demo').mkdir(parents=True)
        os.environ['HERMES_HOME'] = str(custom / 'profiles' / 'demo')
        self.assertEqual(api.folder_root(), custom)
        api.get_hermes_home = lambda: custom / 'profiles' / 'demo'
        self.assertEqual(self.post().status_code, 200)
        api.get_hermes_home = lambda: self.base / 'unrelated'
        self.assertEqual(self.post().status_code, 403)
        os.environ['HERMES_HOME'] = 'relative'
        self.assertEqual(self.post().status_code, 400)

if __name__ == '__main__': unittest.main(verbosity=2)
