import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { ok, fail, paginate, parsePagination } from '../middleware/response'

const chat = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── 채팅방 목록 ───────────────────────────────────────
chat.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const rooms = await c.env.DB.prepare(`
    SELECT cr.*, crm.last_read_at,
      (SELECT COUNT(*) FROM chat_messages cm
       WHERE cm.room_id = cr.id AND cm.is_deleted = 0
       AND (crm.last_read_at IS NULL OR cm.created_at > crm.last_read_at)) as unread_count,
      (SELECT cm2.content FROM chat_messages cm2
       WHERE cm2.room_id = cr.id AND cm2.is_deleted = 0
       ORDER BY cm2.created_at DESC LIMIT 1) as last_message,
      (SELECT cm3.created_at FROM chat_messages cm3
       WHERE cm3.room_id = cr.id AND cm3.is_deleted = 0
       ORDER BY cm3.created_at DESC LIMIT 1) as last_message_at
    FROM chat_rooms cr
    JOIN chat_room_members crm ON crm.room_id = cr.id
    WHERE crm.user_id = ? AND crm.left_at IS NULL AND cr.is_active = 1
    ORDER BY last_message_at DESC
  `).bind(userId).all()

  return c.json(ok(rooms.results))
})

// ── 1:1 채팅방 시작 / 조회 ───────────────────────────
chat.post(
  '/direct',
  authMiddleware,
  zValidator('json', z.object({
    target_user_id: z.number().int().positive()
  })),
  async (c) => {
    const userId = c.get('userId')
    const { target_user_id } = c.req.valid('json')

    if (userId === target_user_id) {
      return c.json(fail('자신과 채팅할 수 없습니다.'), 400)
    }

    // 명함 교환 여부 확인
    const hasContact = await c.env.DB.prepare(`
      SELECT id FROM card_contacts
      WHERE (owner_id = ? AND card_id IN (SELECT id FROM cards WHERE user_id = ?))
        OR (owner_id = ? AND card_id IN (SELECT id FROM cards WHERE user_id = ?))
      LIMIT 1
    `).bind(userId, target_user_id, target_user_id, userId).first()

    if (!hasContact) {
      return c.json(fail('명함을 교환한 상대방과만 채팅할 수 있습니다.'), 403)
    }

    // 기존 1:1 채팅방 조회
    const existing = await c.env.DB.prepare(`
      SELECT cr.id FROM chat_rooms cr
      JOIN chat_room_members crm1 ON crm1.room_id = cr.id AND crm1.user_id = ?
      JOIN chat_room_members crm2 ON crm2.room_id = cr.id AND crm2.user_id = ?
      WHERE cr.room_type = 'direct' AND cr.is_active = 1
      LIMIT 1
    `).bind(userId, target_user_id).first<{ id: number }>()

    if (existing) {
      return c.json(ok({ room_id: existing.id, is_new: false }))
    }

    // 새 채팅방 생성
    const result = await c.env.DB.prepare(
      `INSERT INTO chat_rooms (room_type) VALUES ('direct')`
    ).run()
    const roomId = result.meta.last_row_id as number

    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(roomId, userId),
      c.env.DB.prepare('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(roomId, target_user_id)
    ])

    return c.json(ok({ room_id: roomId, is_new: true }), 201)
  }
)

// ── 메시지 목록 조회 ──────────────────────────────────
chat.get('/:roomId/messages', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const roomId = parseInt(c.req.param('roomId'))
  const { page, limit, offset } = parsePagination(c.req.query('page'), c.req.query('limit'))

  // 채팅방 멤버 확인
  const membership = await c.env.DB.prepare(
    'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL'
  ).bind(roomId, userId).first()

  if (!membership) return c.json(fail('채팅방에 접근할 수 없습니다.'), 403)

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT cm.*, u.name as sender_name, u.avatar_url as sender_avatar
      FROM chat_messages cm
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.room_id = ? AND cm.is_deleted = 0
        AND (cm.expires_at IS NULL OR cm.expires_at > datetime('now'))
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(roomId, limit, offset).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM chat_messages WHERE room_id = ? AND is_deleted = 0`).bind(roomId).first<{ total: number }>()
  ])

  // 읽음 처리 업데이트
  await c.env.DB.prepare(
    `UPDATE chat_room_members SET last_read_at = datetime('now') WHERE room_id = ? AND user_id = ?`
  ).bind(roomId, userId).run()

  return c.json(paginate(rows.results, countRow?.total ?? 0, page, limit))
})

// ── 메시지 전송 ───────────────────────────────────────
chat.post(
  '/:roomId/messages',
  authMiddleware,
  zValidator('json', z.object({
    message_type: z.enum(['text', 'image', 'file', 'card']).default('text'),
    content: z.string().max(5000).optional(),
    file_url: z.string().url().optional(),
    card_id: z.number().int().positive().optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const userPlan = c.get('userPlan')
    const roomId = parseInt(c.req.param('roomId'))
    const body = c.req.valid('json')

    const membership = await c.env.DB.prepare(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL AND is_blocked = 0'
    ).bind(roomId, userId).first()

    if (!membership) return c.json(fail('채팅방에 접근할 수 없습니다.'), 403)

    if (!body.content && !body.file_url && !body.card_id) {
      return c.json(fail('전송할 내용이 없습니다.'), 400)
    }

    // 플랜별 메시지 만료 시간 설정 (plan_configs 기반, 0=무제한)
    let expiresAt: string | null = null
    const retentionKey = `chat_retention_${userPlan ?? 'free'}`
    const retentionRow = await c.env.DB.prepare(
      `SELECT config_val FROM plan_configs WHERE config_key = ?`
    ).bind(retentionKey).first<{ config_val: string }>()
    const retentionDays = retentionRow ? parseInt(retentionRow.config_val) : (userPlan === 'free' ? 1 : 0)

    if (retentionDays > 0) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + retentionDays)
      expiry.setHours(0, 0, 0, 0)
      expiresAt = expiry.toISOString()
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO chat_messages (room_id, sender_id, message_type, content, file_url, card_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      roomId, userId, body.message_type,
      body.content ?? null, body.file_url ?? null, body.card_id ?? null, expiresAt
    ).run()

    // 채팅방 업데이트 시간 갱신
    await c.env.DB.prepare(`UPDATE chat_rooms SET updated_at = datetime('now') WHERE id = ?`).bind(roomId).run()

    const message = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(result.meta.last_row_id).first()
    return c.json(ok(message), 201)
  }
)

// ── 메시지 삭제 (본인 메시지) ────────────────────────
chat.delete('/:roomId/messages/:msgId', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const msgId = c.req.param('msgId')

  await c.env.DB.prepare(`
    UPDATE chat_messages
    SET is_deleted = 1, deleted_at = datetime('now')
    WHERE id = ? AND sender_id = ? AND is_deleted = 0
  `).bind(msgId, userId).run()

  return c.json(ok(null, '메시지가 삭제되었습니다.'))
})

// ── 신고 ──────────────────────────────────────────────
chat.post(
  '/report',
  authMiddleware,
  zValidator('json', z.object({
    target_type: z.enum(['user', 'message', 'card', 'group']),
    target_id: z.number().int().positive(),
    reason: z.string().min(1).max(200),
    description: z.string().max(1000).optional()
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    await c.env.DB.prepare(`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, body.target_type, body.target_id, body.reason, body.description ?? null).run()

    return c.json(ok(null, '신고가 접수되었습니다.'), 201)
  }
)

// ── 채팅 파일 업로드 (이미지/파일 → R2) ─────────────
// POST /api/v1/chat/:roomId/upload
// Content-Type: multipart/form-data
// form fields:
//   file     : 이미지 또는 파일 (필수)
//   file_type : 'image' | 'file' (선택, 기본 자동 감지)
chat.post('/:roomId/upload', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const roomId = parseInt(c.req.param('roomId'))

  // 채팅방 멤버 + 차단 여부 확인
  const membership = await c.env.DB.prepare(
    'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL AND is_blocked = 0'
  ).bind(roomId, userId).first()

  if (!membership) return c.json(fail('채팅방에 접근할 수 없습니다.'), 403)

  // multipart/form-data 파싱
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json(fail('파일을 업로드해주세요.'), 400)
  }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string') {
    return c.json(fail('file 필드에 파일을 첨부해주세요.'), 400)
  }

  // 허용 타입 및 크기 정책
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const FILE_TYPES  = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]
  const ALLOWED_TYPES = [...IMAGE_TYPES, ...FILE_TYPES]
  const MAX_IMAGE_SIZE = 5  * 1024 * 1024  // 5MB
  const MAX_FILE_SIZE  = 20 * 1024 * 1024  // 20MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json(fail('지원하지 않는 파일 형식입니다. (이미지: JPG·PNG·WEBP·GIF / 파일: PDF·Word·Excel·TXT)'), 400)
  }

  const isImage = IMAGE_TYPES.includes(file.type)
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE
  if (file.size > maxSize) {
    return c.json(fail(`파일 크기는 ${isImage ? '5MB' : '20MB'} 이하여야 합니다.`), 400)
  }

  // R2 키 생성
  // chat/{roomId}/{userId}_{timestamp}_{originalName}
  const safeFileName = file.name
    ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    : `file_${Date.now()}`
  const key = `chat/${roomId}/${userId}_${Date.now()}_${safeFileName}`

  // R2 업로드
  const arrayBuffer = await file.arrayBuffer()
  await c.env.STORAGE.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  })

  const fileUrl  = `https://pub-9e92c640989d47f69f8e3f749c4de9c0.r2.dev/${key}`
  const msgType  = isImage ? 'image' : 'file'

  // 플랜별 메시지 만료 시간 설정 (기존 전송 로직과 동일)
  const userPlan = c.get('userPlan')
  let expiresAt: string | null = null
  const retentionKey = `chat_retention_${userPlan ?? 'free'}`
  const retentionRow = await c.env.DB.prepare(
    `SELECT config_val FROM plan_configs WHERE config_key = ?`
  ).bind(retentionKey).first<{ config_val: string }>()
  const retentionDays = retentionRow
    ? parseInt(retentionRow.config_val)
    : (userPlan === 'free' ? 1 : 0)

  if (retentionDays > 0) {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + retentionDays)
    expiry.setHours(0, 0, 0, 0)
    expiresAt = expiry.toISOString()
  }

  // chat_messages에 자동 저장
  const result = await c.env.DB.prepare(`
    INSERT INTO chat_messages (room_id, sender_id, message_type, content, file_url, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    roomId, userId, msgType,
    file.name ?? null,   // content = 원본 파일명 (UI 표시용)
    fileUrl,
    expiresAt
  ).run()

  // 채팅방 updated_at 갱신
  await c.env.DB.prepare(
    `UPDATE chat_rooms SET updated_at = datetime('now') WHERE id = ?`
  ).bind(roomId).run()

  const message = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE id = ?'
  ).bind(result.meta.last_row_id).first()

  return c.json(ok({
    message,
    file_url : fileUrl,
    file_type: msgType,
    file_name: file.name ?? null,
    file_size: file.size,
  }, '파일이 전송되었습니다.'), 201)
})

// ── 차단 ──────────────────────────────────────────────
chat.post(
  '/block',
  authMiddleware,
  zValidator('json', z.object({
    blocked_user_id: z.number().int().positive()
  })),
  async (c) => {
    const userId = c.get('userId')
    const { blocked_user_id } = c.req.valid('json')

    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)'
    ).bind(userId, blocked_user_id).run()

    return c.json(ok(null, '차단되었습니다.'))
  }
)

export default chat
