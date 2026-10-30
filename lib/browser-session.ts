/** These helpers contain no stored seat credentials and work on a local LAN. */
export function newActionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function invitationLink(origin: string, room: string, inviteCode?: string) {
  const url = new URL('/', origin);
  url.searchParams.set('room', room);
  if (inviteCode) url.hash = new URLSearchParams({invite: inviteCode}).toString();
  return url.toString();
}
export function readInvitation(url: string) {
  const parsed = new URL(url);
  const room = (parsed.searchParams.get('room') || '').trim().toUpperCase();
  const inviteCode = new URLSearchParams(parsed.hash.slice(1)).get('invite') || '';
  return {room: /^[A-Z2-9]{6}$/.test(room) ? room : '', inviteCode: /^[a-f0-9]{64}$/.test(inviteCode) ? inviteCode : ''};
}
