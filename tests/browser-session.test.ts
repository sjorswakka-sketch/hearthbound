import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Native Node tests.
import {invitationLink,readInvitation,newActionId} from '../lib/browser-session.ts';

const invitation='ab12'.repeat(16);

test('LAN invitations round-trip with the invitation key only in the URL fragment',()=>{
 const link=invitationLink('http://192.168.1.25:3000','ABC234',invitation),url=new URL(link);
 assert.equal(url.origin,'http://192.168.1.25:3000');
 assert.equal(url.pathname,'/');assert.equal(url.search,'?room=ABC234');
 assert.equal(url.search.includes(invitation),false);assert.equal(url.hash,`#invite=${invitation}`);
 assert.deepEqual(readInvitation(link),{room:'ABC234',inviteCode:invitation});
});

test('invitation generation excludes existing URLs, fragments and unrelated credentials',()=>{
 const link=invitationLink('https://game.example/old/path?token=private-test-token#old-fragment','ABC234',invitation);
 assert.equal(link.includes('private-test-token'),false);assert.equal(link.includes('old-fragment'),false);
 assert.equal(new URL(link).pathname,'/');assert.deepEqual(readInvitation(link),{room:'ABC234',inviteCode:invitation});
});

test('legacy invitations need no key and room input is normalized',()=>{
 assert.deepEqual(readInvitation(invitationLink('http://localhost:3000','ABC234')),{room:'ABC234',inviteCode:''});
 assert.deepEqual(readInvitation('https://game.example/?room=%20abc234%20'),{room:'ABC234',inviteCode:''});
});

test('untrusted invitation URLs reject malformed room codes and invitation values',()=>{
 for(const room of ['ABC23','ABC2345','AB0123','ABC-23','<html>'])assert.equal(readInvitation(`https://game.example/?room=${encodeURIComponent(room)}`).room,'');
 for(const value of ['short','g'.repeat(64),'a'.repeat(63),'a'.repeat(65),'A'.repeat(64)])assert.equal(readInvitation(`https://game.example/?room=ABC234#invite=${value}`).inviteCode,'');
 assert.equal(readInvitation(`https://game.example/?room=ABC234&invite=${invitation}`).inviteCode,'');
});

test('action IDs work when secure-context randomUUID is unavailable',t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);});
 let calls=0;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(array:Uint8Array){calls++;assert.ok(array instanceof Uint8Array);assert.equal(array.length,16);for(let i=0;i<array.length;i++)array[i]=i;return array;}}});
 assert.equal(typeof crypto.randomUUID,'undefined');
 assert.equal(newActionId(),'000102030405060708090a0b0c0d0e0f');
 assert.equal(calls,1);
});

test('separate actions receive unique IDs accepted by the server length contract',()=>{
 const ids=Array.from({length:1000},()=>newActionId());
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ids){assert.match(id,/^[a-f0-9]{32}$/);assert.ok(id.length>=8&&id.length<=100);}
});
