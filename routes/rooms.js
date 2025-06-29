var express = require('express');
var router = express.Router();
const roomsModel = require('../models/roomsModel');

// rooms router
// POST /rooms/
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
  const userId = req.user.id;
  const body = req.body;

  const isHost = await roomsModel.isHost(userId);
  const activeCount = await roomsModel.getActiveRoomCount(userId);

  if (isHost || activeCount >= 2) {
    return res.status(409).json({
      error: '한 사용자는 하나의 모임만 생성하거나 두 개까지만 참여 가능합니다.',
    });
  }

  const result = await roomsModel.createRoom({
    ...body,
    roomHost: userId,
    currentParticipants: userId,
  });

  res.json(result);
});

// PATCH /rooms/:id 방정보 수정
router.patch('/:id', async (req, res) => {
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
  const userId = req.user.id;

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
router.post('/:id/join', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  const result = await roomsModel.joinRoom(roomId, userId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

// POST /rooms/:id/leave 방 나가기
router.post('/:id/leave', async (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  const result = await roomsModel.leaveRoom(roomId, userId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

// PATCH /rooms/:id/participants/:userId 강제 퇴장
router.patch('/:id/participants/:userId', async (req, res) => {
  const roomId = req.params.id;
  const targetUserId = req.params.userId;
  const result = await roomsModel.kickUserFromRoom(roomId, targetUserId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

module.exports = router;
