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
  const result = await roomsModel.updateRoomInfo(roomId, req.body);
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

// POST /rooms/:id/join 방 참가
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

module.exports = router;
