/**
 * Messaging routes — Phase 5 (P2P End-to-End Encrypted Messaging)
 *
 *   POST   /api/messages/keys                     Upload / rotate my public key
 *   GET    /api/messages/keys/:userId             Fetch a user's public key
 *   GET    /api/messages/contacts                 People I'm allowed to message
 *   GET    /api/messages/conversations            My conversations (+ unread)
 *   POST   /api/messages/conversations            Start / fetch a conversation
 *   GET    /api/messages/unread-count             Total unread across conversations
 *   POST   /api/messages/send                     Send an encrypted message
 *   POST   /api/messages/upload                   Send an encrypted file attachment
 *   POST   /api/messages/typing                   Set a typing indicator
 *   POST   /api/messages/read                     Mark a conversation read
 *   POST   /api/messages/report                   Report abuse
 *   GET    /api/messages/:conversationId          Messages in a conversation
 *   GET    /api/messages/:id/attachment           Download an encrypted attachment
 *
 * E2E: the server stores only opaque ciphertext + RSA-wrapped content keys.
 * It can never read message or file plaintext. Only patients & practitioners
 * (and admins) may use messaging; a conversation is always one patient with
 * one practitioner.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { audit } = require('../lib/helpers');
const cryptoLib = require('../lib/crypto');

const router = express.Router();

/* ----------------------------- in-memory typing state ----------------------------- */
// Map<conversationId, Map<userId, timestampMs>>  — ephemeral, best-effort.
const typingState = new Map();
const TYPING_TTL = 8000;
function setTyping(conversationId, userId) {
  if (!typingState.has(conversationId)) typingState.set(conversationId, new Map());
  typingState.get(conversationId).set(userId, Date.now());
}
function isOtherTyping(conversationId, meId) {
  const conv = typingState.get(conversationId);
  if (!conv) return false;
  const now = Date.now();
  for (const [uid, ts] of conv.entries()) {
    if (uid !== meId && now - ts < TYPING_TTL) return true;
  }
  return false;
}

/* ----------------------------- helpers ----------------------------- */
const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;

function requireMessagingRole(req, res, next) {
  if (!['patient', 'practitioner', 'admin'].includes(req.user.role))
    return res.status(403).json({ error: 'Messaging is not available for this role' });
  next();
}

async function getUser(id) {
  const r = await db.query('SELECT id, full_name, first_name, last_name, role, avatar_url FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}

function shapeContact(u, opts = {}) {
  return {
    id: u.id,
    name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Member',
    role: u.role,
    avatarUrl: u.avatar_url || null,
    hasKey: !!opts.hasKey,
    assigned: !!opts.assigned,
  };
}

/**
 * Resolve the (patient_id, practitioner_id) pair for a conversation between me
 * and `other`. Exactly one must be a patient and one a practitioner. Admins act
 * as practitioners for messaging purposes.
 */
function resolvePair(me, other) {
  const roleAsSide = (u) => (u.role === 'patient' ? 'patient' : 'practitioner');
  const meSide = roleAsSide(me);
  const otherSide = roleAsSide(other);
  if (meSide === otherSide) return null; // both patients or both practitioners → not allowed
  const patient = meSide === 'patient' ? me : other;
  const practitioner = meSide === 'practitioner' ? me : other;
  return { patientId: patient.id, practitionerId: practitioner.id };
}

/** Find-or-create a conversation between me and other; returns the conversation row. */
async function ensureConversation(me, other) {
  const pair = resolvePair(me, other);
  if (!pair) return null;
  const existing = await db.query(
    'SELECT * FROM conversations WHERE patient_id=$1 AND practitioner_id=$2',
    [pair.patientId, pair.practitionerId]
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await db.query(
    'INSERT INTO conversations (patient_id, practitioner_id) VALUES ($1,$2) RETURNING *',
    [pair.patientId, pair.practitionerId]
  );
  return ins.rows[0];
}

/** Load a conversation if the requester is a participant, else null. */
async function getConversationForUser(conversationId, userId) {
  const r = await db.query(
    'SELECT * FROM conversations WHERE id=$1 AND (patient_id=$2 OR practitioner_id=$2)',
    [conversationId, userId]
  );
  return r.rows[0] || null;
}

const otherParty = (conv, meId) => (conv.patient_id === meId ? conv.practitioner_id : conv.patient_id);

/* ============================ KEY EXCHANGE ============================ */

// Upload / rotate my public key
router.post('/keys', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { publicKey, algorithm } = req.body || {};
    if (!publicKey || typeof publicKey !== 'string') return res.status(400).json({ error: 'publicKey is required' });
    if (publicKey.length > 8192) return res.status(400).json({ error: 'publicKey too large' });
    const fp = cryptoLib.fingerprint(publicKey);
    const r = await db.query(
      `INSERT INTO encryption_keys (user_id, public_key, algorithm, fingerprint)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET public_key=EXCLUDED.public_key,
         algorithm=EXCLUDED.algorithm, fingerprint=EXCLUDED.fingerprint, updated_at=now()
       RETURNING user_id, fingerprint, algorithm, created_at`,
      [req.user.userId, publicKey, algorithm || 'RSA-OAEP-256', fp]
    );
    res.json({ key: r.rows[0] });
  } catch (err) { console.error('messages/keys POST', err); res.status(500).json({ error: 'Server error' }); }
});

// Fetch a user's public key
router.get('/keys/:userId', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const r = await db.query('SELECT user_id, public_key, algorithm, fingerprint FROM encryption_keys WHERE user_id=$1', [req.params.userId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No key registered for this user', publicKey: null });
    const k = r.rows[0];
    res.json({ userId: k.user_id, publicKey: k.public_key, algorithm: k.algorithm, fingerprint: k.fingerprint });
  } catch (err) { console.error('messages/keys GET', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ CONTACTS ============================ */

// People the current user may message (opposite side).
router.get('/contacts', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const me = await getUser(req.user.userId);
    if (!me) return res.status(404).json({ error: 'User not found' });

    const wantRole = me.role === 'patient' ? 'practitioner' : 'patient';
    const people = await db.query(
      `SELECT id, full_name, first_name, last_name, role, avatar_url
         FROM users WHERE role=$1 AND id<>$2 ORDER BY full_name ASC`,
      [wantRole, me.id]
    );

    // which contacts already have an encryption key
    const keyRows = await db.query('SELECT user_id FROM encryption_keys');
    const keyed = new Set(keyRows.rows.map((r) => r.user_id));

    // "assigned" links derived from bookings (patient ↔ practitioner via listing ownership)
    let assigned = new Set();
    if (me.role === 'patient') {
      const a = await db.query(
        `SELECT DISTINCT l.owner_user_id AS pid FROM booking_requests b
           JOIN listings l ON l.id=b.listing_id
          WHERE b.user_id=$1 AND l.owner_user_id IS NOT NULL`, [me.id]);
      assigned = new Set(a.rows.map((r) => r.pid));
    } else {
      const a = await db.query(
        `SELECT DISTINCT b.user_id AS pid FROM booking_requests b
           JOIN listings l ON l.id=b.listing_id
          WHERE l.owner_user_id=$1`, [me.id]);
      assigned = new Set(a.rows.map((r) => r.pid));
    }

    const contacts = people.rows.map((u) =>
      shapeContact(u, { hasKey: keyed.has(u.id), assigned: assigned.has(u.id) }));
    res.json({ contacts, me: shapeContact(me, { hasKey: keyed.has(me.id) }) });
  } catch (err) { console.error('messages/contacts', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ CONVERSATIONS ============================ */

router.get('/conversations', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const meId = req.user.userId;
    const convs = await db.query(
      `SELECT c.*,
        pu.full_name AS patient_name, pu.avatar_url AS patient_avatar,
        ru.full_name AS practitioner_name, ru.avatar_url AS practitioner_avatar
       FROM conversations c
       JOIN users pu ON pu.id=c.patient_id
       JOIN users ru ON ru.id=c.practitioner_id
       WHERE c.patient_id=$1 OR c.practitioner_id=$1
       ORDER BY c.updated_at DESC`, [meId]);

    const out = [];
    for (const c of convs.rows) {
      const otherId = otherParty(c, meId);
      const isPatientMe = c.patient_id === meId;
      const otherName = isPatientMe ? c.practitioner_name : c.patient_name;
      const otherAvatar = isPatientMe ? c.practitioner_avatar : c.patient_avatar;
      const otherRole = isPatientMe ? 'practitioner' : 'patient';

      const last = await db.query(
        'SELECT id, sender_id, message_type, has_attachment, created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1',
        [c.id]);
      const unread = await db.query(
        'SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL',
        [c.id, meId]);

      out.push({
        id: c.id,
        otherId, otherName: otherName || 'Member', otherAvatar, otherRole,
        unread: unread.rows[0].n,
        updatedAt: c.updated_at,
        lastMessage: last.rows[0] ? {
          id: last.rows[0].id,
          fromMe: last.rows[0].sender_id === meId,
          type: last.rows[0].message_type,
          hasAttachment: last.rows[0].has_attachment,
          createdAt: last.rows[0].created_at,
        } : null,
      });
    }
    res.json({ conversations: out });
  } catch (err) { console.error('messages/conversations', err); res.status(500).json({ error: 'Server error' }); }
});

// Start (or fetch) a conversation with a given contact
router.post('/conversations', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { contactId } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });
    if (contactId === req.user.userId) return res.status(400).json({ error: 'Cannot message yourself' });
    const me = await getUser(req.user.userId);
    const other = await getUser(contactId);
    if (!other) return res.status(404).json({ error: 'Contact not found' });
    const conv = await ensureConversation(me, other);
    if (!conv) return res.status(400).json({ error: 'A conversation must be between a patient and a practitioner' });
    res.status(201).json({
      conversationId: conv.id,
      otherId: other.id,
      otherName: other.full_name || 'Member',
      otherRole: other.role,
    });
  } catch (err) { console.error('messages/conversations POST', err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/unread-count', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT COUNT(*)::int AS n FROM messages m
        JOIN conversations c ON c.id=m.conversation_id
       WHERE (c.patient_id=$1 OR c.practitioner_id=$1)
         AND m.sender_id<>$1 AND m.read_at IS NULL`, [req.user.userId]);
    res.json({ unread: r.rows[0].n });
  } catch (err) { console.error('messages/unread-count', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ SEND ============================ */

router.post('/send', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { conversationId, contactId, encryptedContent, iv, encKeySender, encKeyRecipient } = req.body || {};

    const valid = cryptoLib.validateEncryptedMessage({ encryptedContent, iv, encKeyRecipient });
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    // resolve conversation (existing id, or create from contactId)
    let conv;
    if (conversationId) {
      conv = await getConversationForUser(conversationId, req.user.userId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else if (contactId) {
      const me = await getUser(req.user.userId);
      const other = await getUser(contactId);
      if (!other) return res.status(404).json({ error: 'Contact not found' });
      conv = await ensureConversation(me, other);
      if (!conv) return res.status(400).json({ error: 'Invalid participants' });
    } else {
      return res.status(400).json({ error: 'conversationId or contactId is required' });
    }

    const ins = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, encrypted_content, iv, enc_key_sender, enc_key_recipient, message_type)
       VALUES ($1,$2,$3,$4,$5,$6,'text') RETURNING id, created_at`,
      [conv.id, req.user.userId, encryptedContent, iv, encKeySender || null, encKeyRecipient]
    );
    await db.query('UPDATE conversations SET updated_at=now() WHERE id=$1', [conv.id]);
    typingState.get(conv.id)?.delete(req.user.userId);

    await audit({
      actorId: req.user.userId, action: 'message.send', resourceType: 'message',
      resourceId: ins.rows[0].id, newValues: { conversationId: conv.id }, ip: clientIp(req),
    });

    res.status(201).json({ id: ins.rows[0].id, conversationId: conv.id, createdAt: ins.rows[0].created_at });
  } catch (err) { console.error('messages/send', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ ATTACHMENTS ============================ */

router.post('/upload', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const {
      conversationId, contactId,
      encryptedBlob, encryptedFilename, iv, encKeySender, encKeyRecipient,
      size, mimeType,
      // a (small) encrypted caption shown in the bubble, same shape as a text message
      encryptedContent, captionIv, captionKeySender, captionKeyRecipient,
    } = req.body || {};

    const valid = cryptoLib.validateEncryptedAttachment({ encryptedBlob, iv, encKeyRecipient, size });
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    let conv;
    if (conversationId) {
      conv = await getConversationForUser(conversationId, req.user.userId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else if (contactId) {
      const me = await getUser(req.user.userId);
      const other = await getUser(contactId);
      if (!other) return res.status(404).json({ error: 'Contact not found' });
      conv = await ensureConversation(me, other);
      if (!conv) return res.status(400).json({ error: 'Invalid participants' });
    } else {
      return res.status(400).json({ error: 'conversationId or contactId is required' });
    }

    // The message row carries an (optional) encrypted caption; the blob lives in attachments.
    const msg = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, encrypted_content, iv, enc_key_sender, enc_key_recipient, message_type, has_attachment)
       VALUES ($1,$2,$3,$4,$5,$6,'file',TRUE) RETURNING id, created_at`,
      [
        conv.id, req.user.userId,
        encryptedContent || '', captionIv || iv,
        captionKeySender || null, captionKeyRecipient || encKeyRecipient,
      ]
    );

    const att = await db.query(
      `INSERT INTO message_attachments
        (message_id, encrypted_filename, encrypted_blob, iv, enc_key_sender, enc_key_recipient, size, mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, size, mime_type`,
      [msg.rows[0].id, encryptedFilename || null, encryptedBlob, iv, encKeySender || null, encKeyRecipient, size || null, mimeType || 'application/octet-stream']
    );

    await db.query('UPDATE conversations SET updated_at=now() WHERE id=$1', [conv.id]);

    await audit({
      actorId: req.user.userId, action: 'message.upload', resourceType: 'message_attachment',
      resourceId: att.rows[0].id, newValues: { conversationId: conv.id, size: size || null }, ip: clientIp(req),
    });

    res.status(201).json({
      id: msg.rows[0].id, conversationId: conv.id, createdAt: msg.rows[0].created_at,
      attachmentId: att.rows[0].id,
    });
  } catch (err) { console.error('messages/upload', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ TYPING / READ / REPORT ============================ */

router.post('/typing', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { conversationId } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
    const conv = await getConversationForUser(conversationId, req.user.userId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    setTyping(conversationId, req.user.userId);
    res.json({ ok: true });
  } catch (err) { console.error('messages/typing', err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/read', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { conversationId } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
    const conv = await getConversationForUser(conversationId, req.user.userId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const upd = await db.query(
      'UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL RETURNING id',
      [conversationId, req.user.userId]);
    res.json({ ok: true, marked: upd.rowCount });
  } catch (err) { console.error('messages/read', err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/report', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const { conversationId, messageId, reason } = req.body || {};
    if (conversationId) {
      const conv = await getConversationForUser(conversationId, req.user.userId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    }
    const ins = await db.query(
      `INSERT INTO message_reports (reporter_id, conversation_id, message_id, reason)
       VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [req.user.userId, conversationId || null, messageId || null, (reason || '').slice(0, 2000)]
    );
    await audit({
      actorId: req.user.userId, action: 'message.report', resourceType: 'message_report',
      resourceId: ins.rows[0].id, newValues: { conversationId: conversationId || null, messageId: messageId || null }, ip: clientIp(req),
    });
    res.status(201).json({ ok: true, id: ins.rows[0].id });
  } catch (err) { console.error('messages/report', err); res.status(500).json({ error: 'Server error' }); }
});

/* ============================ READ A CONVERSATION ============================ */

// Download an encrypted attachment (must be a participant). Returns ciphertext + wrapped keys.
router.get('/:id/attachment', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT a.*, m.conversation_id, m.sender_id, c.patient_id, c.practitioner_id
         FROM message_attachments a
         JOIN messages m ON m.id=a.message_id
         JOIN conversations c ON c.id=m.conversation_id
        WHERE a.message_id=$1`, [req.params.id]);
    const a = r.rows[0];
    if (!a) return res.status(404).json({ error: 'Attachment not found' });
    if (a.patient_id !== req.user.userId && a.practitioner_id !== req.user.userId)
      return res.status(403).json({ error: 'Not authorized for this attachment' });

    await audit({
      actorId: req.user.userId, action: 'message.attachment.access', resourceType: 'message_attachment',
      resourceId: a.id, ip: clientIp(req),
    });

    res.json({
      id: a.id,
      messageId: a.message_id,
      encryptedBlob: a.encrypted_blob,
      encryptedFilename: a.encrypted_filename,
      iv: a.iv,
      encKey: a.sender_id === req.user.userId ? a.enc_key_sender : a.enc_key_recipient,
      size: a.size,
      mimeType: a.mime_type,
    });
  } catch (err) { console.error('messages/attachment', err); res.status(500).json({ error: 'Server error' }); }
});

// Messages in a conversation (marks the other party's messages read).
router.get('/:conversationId', authMiddleware, requireMessagingRole, async (req, res) => {
  try {
    const meId = req.user.userId;
    const conv = await getConversationForUser(req.params.conversationId, meId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const rows = await db.query(
      `SELECT m.id, m.sender_id, m.encrypted_content, m.iv, m.enc_key_sender, m.enc_key_recipient,
              m.message_type, m.has_attachment, m.created_at, m.read_at,
              a.id AS attachment_id, a.mime_type, a.size, a.encrypted_filename
         FROM messages m
         LEFT JOIN message_attachments a ON a.message_id=m.id
        WHERE m.conversation_id=$1 ORDER BY m.created_at ASC`, [req.params.conversationId]);

    const messages = rows.rows.map((m) => ({
      id: m.id,
      fromMe: m.sender_id === meId,
      senderId: m.sender_id,
      encryptedContent: m.encrypted_content,
      iv: m.iv,
      // hand each user only the key envelope they can open
      encKey: m.sender_id === meId ? m.enc_key_sender : m.enc_key_recipient,
      type: m.message_type,
      hasAttachment: m.has_attachment,
      createdAt: m.created_at,
      readAt: m.read_at,
      attachment: m.attachment_id ? {
        id: m.attachment_id, mimeType: m.mime_type, size: m.size,
        encryptedFilename: m.encrypted_filename,
        encFilenameKey: m.sender_id === meId ? m.enc_key_sender : m.enc_key_recipient,
      } : null,
    }));

    // mark incoming as read
    await db.query(
      'UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL',
      [req.params.conversationId, meId]);

    const otherId = otherParty(conv, meId);
    await audit({
      actorId: meId, action: 'message.conversation.access', resourceType: 'conversation',
      resourceId: conv.id, ip: clientIp(req),
    });

    res.json({
      conversationId: conv.id,
      otherId,
      messages,
      typing: isOtherTyping(conv.id, meId),
    });
  } catch (err) { console.error('messages/:conversationId', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
