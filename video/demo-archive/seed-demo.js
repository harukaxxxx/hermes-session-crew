// Paste in the authenticated demo Webapp's browser console; no credentials are handled here.
// Uses the Hermes session import HTTP API. This is unverified until run against the demo gateway.
(async () => {
  if (!['http://127.0.0.1:4178', 'http://192.168.1.100:4178'].includes(location.origin)) throw new Error('Refusing: not the isolated demo origin');
  const datasets = [
    ['default', 'sessioncrew-demo-default', 'Demo: planning', 'Plan a small product launch.', 'Draft the launch checklist and assign owners.'],
    ['aria', 'sessioncrew-demo-aria', 'Demo: research', 'Summarize the fictional research notes.', 'The synthetic notes contain three themes.'],
    ['nova', 'sessioncrew-demo-nova', 'Demo: design', 'Explore a dashboard layout.', 'Use a compact sidebar and clear session labels.']
  ];
  for (const [profile, id, title, user, assistant] of datasets) {
    const body = {profile, request_id: `seed-${id}`, expected_revision: 0, sessions: [{id, title, source: 'cli', messages: [{role: 'user', content: user}, {role: 'assistant', content: assistant}]}]};
    const response = await fetch('/api/sessions/import', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok || !result.imported_ids?.includes(id)) throw new Error(`${profile}: ${response.status} ${JSON.stringify(result)}`);
    console.log(`Imported ${id} into ${profile}`, result);
  }
})().catch(error => console.error('Demo seed stopped:', error.message));
