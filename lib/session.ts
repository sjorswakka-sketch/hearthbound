// @ts-ignore Explicit extension also supports native Node tests.
import { GameError, type Action, type GameState, type Member } from './game.ts';

export type SessionData = {
  locked: boolean;
  inviteRequired: boolean;
  inviteVersion: number;
  inviteHash?: string;
};
export type SessionState = GameState & { session?: SessionData };

/** Old campaigns remain joinable by their existing table code. */
export function sessionData(state: GameState): SessionData {
  const stored = state as SessionState;
  return stored.session ??= { locked: false, inviteRequired: false, inviteVersion: 0 };
}

/** Never send invite hashes to a browser, including the GM's browser. */
export function publicSession(state: GameState) {
  const session = sessionData(state);
  return { locked: session.locked, inviteRequired: session.inviteRequired, inviteVersion: session.inviteVersion };
}

export function requireGm(member: Member) {
  if (member.role !== 'gm') throw new GameError('Only the GM can manage the table.', 403);
}

export function requireJoinAccess(state: GameState, invitationHash?: string) {
  const session = sessionData(state);
  if (session.locked) throw new GameError('This table is locked to new players. Ask the GM to unlock it.', 403);
  if (session.inviteRequired && (!session.inviteHash || invitationHash !== session.inviteHash)) {
    throw new GameError('A current invitation is required. Ask the GM for a new invite link.', 403);
  }
}

export function rotateInvitation(state: GameState, member: Member, invitationHash: string) {
  requireGm(member);
  if (!/^[a-f0-9]{64}$/.test(invitationHash)) throw new GameError('Invalid invitation.');
  const session = sessionData(state);
  session.inviteHash = invitationHash;
  session.inviteRequired = true;
  session.inviteVersion += 1;
}

function log(state: GameState, text: string) {
  state.log.push({ id: crypto.randomUUID(), kind: 'world', text, at: new Date().toISOString() });
  state.log = state.log.slice(-100);
}

export function applySessionAction(state: GameState, member: Member, action: Action) {
  requireGm(member);
  if (typeof action.id !== 'string' || action.id.length < 8 || action.id.length > 100) throw new GameError('A valid action ID is required.');
  if (state.processed?.some(p => p.id === action.id && p.memberId === member.id)) return;
  const session = sessionData(state);
  if (action.op === 'lock') {
    if (typeof action.locked !== 'boolean') throw new GameError('Choose whether new players may join.');
    session.locked = action.locked;
    log(state, `The GM ${session.locked ? 'locked' : 'unlocked'} the table for new players.`);
  } else if (action.op === 'assign') {
    if (state.combat.active) throw new GameError('End the encounter before assigning characters.');
    const hero = state.tokens.find(t => t.id === action.tokenId && t.kind === 'hero');
    if (!hero) throw new GameError('Choose a party character.', 404);
    if (action.memberId !== null && typeof action.memberId !== 'string') throw new GameError('Choose a member or release the character.');
    const destination = action.memberId === null ? undefined : state.members.find(m => m.id === action.memberId);
    if (action.memberId !== null && !destination) throw new GameError('That member is no longer at this table.', 404);

    // Character identity and resources stay intact. A seat owns at most one hero.
    for (const seat of state.members) if (seat.characterId === hero.id) delete seat.characterId;
    delete hero.ownerId;
    if (destination) {
      for (const token of state.tokens) if (token.ownerId === destination.id) delete token.ownerId;
      destination.characterId = hero.id;
      hero.ownerId = destination.id;
    }
    // A fog-filtered public announcement must not reveal a concealed hero's name.
    log(state, destination ? `The GM assigned a character to ${destination.name}.` : 'The GM released a character for GM control.');
  } else if (action.op === 'remove') {
    const removed = state.members.find(m => m.id === action.memberId);
    if (!removed) throw new GameError('That member is no longer at this table.', 404);
    if (removed.role === 'gm') throw new GameError('The Game Master cannot be removed.', 403);
    // Removing the entire seat revokes both session and recovery credentials.
    // The character stays in the campaign, including during its combat turn.
    state.members = state.members.filter(m => m.id !== removed.id);
    for (const token of state.tokens) if (token.ownerId === removed.id) delete token.ownerId;
    session.locked = true;
    log(state, `${removed.name} was removed and the table was closed to new players. Their character remains under GM control.`);
  } else {
    throw new GameError('Unknown table-management action.');
  }
  state.processed = [...(state.processed ?? []), { id: action.id, memberId: member.id }].slice(-160);
}

/** An archive is GM-private content, but it never contains working credentials. */
export function campaignArchive(state: GameState, member: Member) {
  requireGm(member);
  const privateKeys = new Set(['tokenHash', 'recoveryHash', 'accountHash', 'inviteHash', 'processed', 'assistantRequestedAt', 'pings']);
  const copy = JSON.parse(JSON.stringify(state, (key, value) => privateKeys.has(key) ? undefined : value)) as SessionState;
  copy.session = publicSession(state);
  return {
    format: 'hearthbound-campaign',
    version: 1,
    exportedAt: new Date().toISOString(),
    notice: 'GM archive: includes private notes and hidden scenes. No session, recovery or invitation credentials are included. Import is not available in this release.',
    state: copy,
  };
}
