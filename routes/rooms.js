var express = require('express');
var router = express.Router();
const roomsModel = require('../models/roomsModel');

// rooms router
// POST /rooms
/**
 * need info
 * 방 생성 모듈
 * roomTitle (방 제목),
 * roomHost (방 호스트),
 * roomDescription (방 설명 (생략 가능)),
 * maxParticipants (최대 참여 가능 인원 (2 ~ 4명)),
 * currentParticipants (현재 참여 인원 (host uuid)),
 * roomEndedAt (방 종료 시간),
 * roomThumbnailImg (방 썸네일 이미지)
 */
router.post('/', async (req, res) => {
  const userId = req.user.user_id;
  const body = req.body;

  // roomsModel 내부에서 host 여부 + 활동 중 방 수 체크함
  const result = await roomsModel.createRoom({
    ...body,
    roomHost: userId
  });

  if (result.error === "모임방을 생성하는데 문제가 발생하였습니다.") {
    return res.status(500).json({ error: result.error });
  }

  if (result.error) {
    return res.status(409).json({ error: result.error });
  }

  res.status(201).json(result);
});

// PATCH /rooms/:id/modify 방정보 수정
router.patch('/:id/modify', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.user_id;

  const result = await roomsModel.updateRoomInfo(roomId, req.body, userId);

  if (result.message.includes("권한이 없습니다")) {
    return res.status(403).json(result);
  }
  
  res.json(result);
});

// PATCH /rooms/:id/deactivate 방 비활성화
router.patch('/:id/deactivate', async (req, res) => {
  const roomId = req.params.id;
  const result = await roomsModel.deactivateRoom(roomId);
  res.json(result);
});

// GET /rooms/:id/participants 방 참가자 목록
router.get('/:id/participants', async (req, res) => {
  const roomId = req.params.id;
  const result = await roomsModel.getRoomParticipants(roomId);
  res.json(result);
});

// GET /rooms/:id/participants/me 내가 해당 방에 참가 중인지 확인
router.get('/:id/participants/me', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.user_id;

  try {
    const participants = await roomsModel.getRoomParticipants(roomId);
    const found = participants.find(p => p.user_id === userId);
    res.json({ joined: !!found });
  } catch (err) {
    console.error("participants/me error:", err);
    res.status(500).json({ error: "참여 여부 확인 실패" });
  }
});

// POST /rooms/:id/joinRoom 방 참가
router.post('/:id/joinRoom', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.user_id;

  const result = await roomsModel.joinRoom(roomId, userId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
  console.log(roomId, userId);
});

// POST /rooms/:id/leaveRoom 방 나가기
router.post('/:id/leaveRoom', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.user_id;

  const result = await roomsModel.leaveRoom(roomId, userId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

// PATCH /rooms/:id/participants/:userId 강제 퇴장
router.patch('/:id/participants/:userId', async (req, res) => {
  const roomId = req.params.id;
  const targetUserId = req.params.userId;
  const requesterId = req.user.user_id;

  try {
    const hostId = await roomsModel.getRoomHost(roomId);

    if (!hostId) {
      return res.status(404).json({ error: '해당 방이 존재하지 않습니다.' });
    }

    if (hostId !== requesterId) {
      return res.status(403).json({ error: '방장만 강퇴할 수 있습니다.' });
    }

    const result = await roomsModel.kickUserFromRoom(roomId, targetUserId);
    if (result.error) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    console.error("강퇴 처리 오류:", err);
    res.status(500).json({ error: '강퇴 처리 중 오류가 발생했습니다.' });
  }
});

const db = require("../db/index");
const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;

router.get('/hosted', async (req, res) => {
  const userId = req.user.user_id;
  try {
    const query = `
      SELECT room_id, room_title, deleted
      FROM ${MAIN_SCHEMA}.room_info
      WHERE room_host = $1
    `;
    const result = await db.query(query, [userId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("GET /rooms/hosted error:", err);
    res.status(500).json({ message: "호스트 방 조회 실패" });
  }
});

/**
 * room_ended_at 도달 시 자동 종료 및 join_state 감소 처리
 * @param {string} roomId
 * @returns {Promise<object|null>} - 처리 메시지 또는 null (종료 아직 안 된 경우)
 */
roomsModel.checkAndEndRoomIfDue = async (roomId) => {
  const client = await pool.connect();
  try {
    // 방 종료 여부 확인
    const { rows } = await client.query(`
      SELECT room_ended_at, deleted FROM ${MAIN_SCHEMA}.room_info
      WHERE room_id = $1
    `, [roomId]);

    if (rows.length === 0) return null;
    const room = rows[0];

    // 이미 종료됐거나 아직 종료 시간이 도달하지 않았으면 아무 것도 하지 않음
    const now = new Date();
    const endedAt = new Date(room.room_ended_at);

    if (room.deleted || now < endedAt) return null;

    await client.query("BEGIN");

    // 방 종료 처리
    await client.query(`
      UPDATE ${MAIN_SCHEMA}.room_info
      SET deleted = false, room_ended_at = $1
      WHERE room_id = $2
    `, [endedAt, roomId]);

    // 참가자들 join_state 감소
    const { rows: participants } = await client.query(`
      SELECT DISTINCT participants_user_id
      FROM ${MAIN_SCHEMA}.participants
      WHERE room_id = $1
    `, [roomId]);

    for (const { participants_user_id } of participants) {
      await client.query(`
        UPDATE ${USER_SCHEMA}.profiles
        SET join_state = CASE WHEN join_state > 0 THEN join_state - 1 ELSE 0 END
        WHERE user_id = $1 AND deleted = false
      `, [participants_user_id]);
    }

    await client.query("COMMIT");
    return { message: "종료 시간 도달로 방 종료 및 방 참가 수 감소 완료" };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("checkAndEndRoomIfDue error:", err);
    return { error: "방 종료 자동 처리 실패" };
  } finally {
    client.release();
  }
};

module.exports = router;
