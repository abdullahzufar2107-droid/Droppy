import { isValidPeerId, newMsgId } from '../utils.js';

export const MAX_GROUP_SIZE = 6;

export class GroupChat {
  groups = new Map();
  deliveries = new Map();

  constructor({ me, queue, connect, getPeer, emit }) {
    this.me = me;
    this.queue = queue;
    this.connect = connect;
    this.getPeer = getPeer;
    this.emit = emit;
  }

  create(name, selected) {
    const members = [this.me.peerId, ...new Set(selected.filter(id => {
      const peer = this.getPeer(id);
      return peer && !peer.blocked;
    }))];
    const title = name.trim().slice(0, 48);
    if (!title || members.length < 3 || members.length > MAX_GROUP_SIZE) return null;
    const names = Object.fromEntries(members.map(id => [id, id === this.me.peerId ? this.me.name : this.getPeer(id)?.name || id]));
    const group = { id: 'group-' + newMsgId(), name: title, owner: this.me.peerId, members, names, lastRead: 0 };
    this.groups.set(group.id, group);
    this.emit('group-save', group);
    for (const id of members.slice(1)) {
      this.invite(group, id);
      this.connect(id);
    }
    return group;
  }

  invite(group, peerId) {
    const { id, name, owner, members, names } = group;
    this.enqueue(peerId, id + '-invite-' + peerId, 'group-invite', { id, name, owner, members, names });
  }

  peerConnected(peerId) {
    for (const group of this.groups.values()) {
      if (group.owner === this.me.peerId && group.members.includes(peerId)) this.invite(group, peerId);
    }
  }

  receive(peerId, packet) {
    const data = packet.payload;
    if (!data || typeof packet.id !== 'string' || typeof data.id !== 'string' || !/^group-[a-z0-9]{14}$/.test(data.id)) return false;
    const known = this.groups.get(data.id);
    if (packet.type === 'group-invite') {
      if (data.owner !== peerId || typeof data.name !== 'string' || !data.name.trim()) return false;
      const members = data.members;
      if (!Array.isArray(members) || members.length < 2 || members.length > MAX_GROUP_SIZE ||
          new Set(members).size !== members.length || !members.every(id => typeof id === 'string' && isValidPeerId(id)) ||
          !members.includes(peerId) || !members.includes(this.me.peerId)) return false;
      if (known) return known.owner === peerId;
      const names = Object.fromEntries(members.map(id => [id, typeof data.names?.[id] === 'string' ? data.names[id].slice(0, 32) : id]));
      const group = { id: data.id, owner: peerId, name: data.name.trim().slice(0, 48), members, names, lastRead: 0 };
      this.groups.set(group.id, group);
      this.emit('group-save', group);
      // Each member opens only the connections they need for group traffic.
      // Group-only connections are hidden from the personal peer list.
      for (const id of members) if (id !== this.me.peerId && id !== peerId) this.connect(id, true);
      return true;
    }

    if (packet.type === 'group-leave') {
      if (!known?.members.includes(peerId)) return false;
      const remaining = known.members.filter(id => id !== peerId);
      if (known.owner === peerId && data.owner !== remaining[0]) return false;
      known.members = remaining;
      if (known.owner === peerId) known.owner = data.owner;
      this.emit('group-save', known);
      return true;
    }

    if (!known?.members.includes(peerId) || typeof data.text !== 'string' || !data.text.trim() ||
        typeof data.messageId !== 'string' || !/^[a-z0-9]{14}$/.test(data.messageId)) return false;
    if (this.queue.isDuplicate(peerId, packet.id)) return true;
    const msg = {
      id: known.id + '-' + peerId + '-' + data.messageId,
      chatId: known.id, dir: 'in', type: 'group', text: data.text.trim().slice(0, 4000),
      author: this.getPeer(peerId)?.name || peerId, ts: Date.now(), status: 'received',
    };
    this.emit('message', { peerId, msg });
    return true;
  }

  send(groupId, text) {
    const group = this.groups.get(groupId);
    const clean = text.trim().slice(0, 4000);
    if (!group || !clean) return false;
    const members = group.members.filter(id => id !== this.me.peerId && !this.getPeer(id)?.blocked);
    if (!members.length) return false;
    const msg = { id: newMsgId(), chatId: groupId, dir: 'out', type: 'group', text: clean, ts: Date.now(),
      status: 'pending', pending: members };
    this.emit('message', { peerId: this.me.peerId, msg });
    this.requeue(msg);
    return true;
  }

  leave(groupId) {
    const group = this.groups.get(groupId);
    if (!group || !group.members.includes(this.me.peerId)) return false;
    const previous = [...group.members];
    group.members = group.members.filter(id => id !== this.me.peerId);
    const nextOwner = group.owner === this.me.peerId ? group.members[0] : group.owner;
    this.groups.delete(groupId);
    for (const peerId of previous) {
      if (peerId !== this.me.peerId) this.enqueue(peerId, groupId + '-leave-' + this.me.peerId, 'group-leave', { id: groupId, owner: nextOwner });
    }
    this.emit('group-left', groupId);
    return true;
  }

  requeue(msg) {
    for (const id of msg.pending) {
      if (this.getPeer(id)?.blocked) continue;
      const deliveryId = msg.id + '-' + id;
      this.deliveries.set(deliveryId, msg);
      this.enqueue(id, deliveryId, 'group-chat', { id: msg.chatId, messageId: msg.id, text: msg.text });
      this.connect(id);
    }
  }

  status(id, peerId, status) {
    const msg = this.deliveries.get(id);
    if (!msg) return false;
    if (status === 'delivered') {
      this.deliveries.delete(id);
      msg.pending = msg.pending.filter(member => member !== peerId);
      if (!msg.pending.length) msg.status = 'delivered';
      this.emit('group-delivery', msg);
    }
    return true;
  }

  enqueue(to, id, type, payload) {
    this.queue.enqueue(to, { id, type, from: this.me.peerId, to, ts: Date.now(), payload });
  }
}
