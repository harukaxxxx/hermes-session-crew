// Missing fixture timestamps are unknown, not inferred from session creation.
// Keys are target profiles, so duplicate session IDs remain owner-scoped.
export function activityResponse(options, byProfile = {}) {
  const {profile, ids} = options.body
  if (typeof profile !== 'string' || !profile || !Array.isArray(ids)) throw Error('invalid recent activity request')
  const times = byProfile[profile] || {}
  return {profile, activity: Object.fromEntries(ids.map(id => [id, Object.hasOwn(times, id) ? times[id] : null]))}
}
