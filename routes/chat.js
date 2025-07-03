const express = require("express");
const router = express.Router();
const chatModel = require("../models/chatModel");


// POST /chat/:roomId/chats 채팅 메시지 전송 (Socket.IO)
router.post("/:roomId/chats", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { chatMsg } = req.body;
    const userId = req.user?.user_id;

    if (!chatMsg || !userId) {
      return res.status(400).json({ error: "메시지 또는 사용자 정보가 없습니다." });
    }

    const result = await chatModel.insertChat(roomId, userId, chatMsg);
    return res.status(201).json(result);
  } catch (err) {
    console.error("채팅 전송 오류:", err);
    return res.status(500).json({ error: "채팅 전송 실패" });
  }
});

// PUT /chat/:roomId/check_attendance 방장이 출석 수동 체크
router.put("/:roomId/check_attendance", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const hostUserId = req.user?.user_id;

    if (!targetUserId || !hostUserId) {
      return res.status(400).json({ error: "필수 정보가 누락되었습니다." });
    }

    const result = await chatModel.markAttendance(roomId, targetUserId, hostUserId);
    if (!result) return res.status(404).json({ error: "출석 대상이 존재하지 않거나 업데이트 실패" });
    if (result?.error) return res.status(result.status).json({ error: result.error });

    return res.status(200).json({ message: "출석 완료", result });
  } catch (err) {
    console.error("수동 출석 체크 오류:", err);
    return res.status(500).json({ error: "출석 체크 실패" });
  }
});

// POST /chat/:roomId/auto_attendance 자동 출석 체크 (미출석자 → false + cold 평판)
router.post("/:roomId/auto_attendance", async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await chatModel.autoAttendance(roomId);
    return res.status(200).json({
      message: "자동 출석 체크 완료",
      ...result
    });
  } catch (err) {
    console.error("자동 출석 체크 오류:", err);
    return res.status(500).json({ error: "자동 출석 체크 실패" });
  }
});

// PATCH /chat/:roomId/status 방 조기 종료
router.patch("/:roomId/status", async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await chatModel.endChatRoom(roomId);
    return res.status(200).json({
      message: "방이 종료되었습니다.",
      room_ended_at: result.room_ended_at
    });
  } catch (err) {
    console.error("방 종료 오류:", err);
    return res.status(500).json({ error: "방 종료 처리 실패" });
  }
});

// GET /chat/:roomId/participants 방 참가자 목록 조회
router.get("/:roomId/participants", async (req, res) => {
  try {
    const { roomId } = req.params;
    const participants = await chatModel.getParticipantsByRoom(roomId);
    return res.status(200).json({ participants });
  } catch (err) {
    console.error("참가자 목록 조회 오류:", err);
    return res.status(500).json({ error: "참가자 목록 조회 실패" });
  }
});

// POST /chat/:userId/reputation 모임 종료 후 유저 평가 (따뜻해 / 차가워)
router.post("/:userId/reputation", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reputation } = req.body;
    const { roomId } = req.query;

    if (!["warm", "cold"].includes(reputation)) {
      return res.status(400).json({ error: "평판 값이 올바르지 않습니다." });
    }

    if (!roomId) {
      return res.status(400).json({ error: "roomId가 필요합니다." });
    }

    // 출석 체크 완료 여부 확인
    const room = await chatModel.getRoomInfo(roomId);
    if (!room?.attendance_checked_at) {
      return res.status(403).json({ error: "아직 출석 체크가 완료되지 않았습니다." });
    }

    // room 종료 여부 확인
    const allowed = await chatModel.isReputationAllowed(roomId);
    if (!allowed) {
      return res.status(403).json({ error: "방이 이미 종료되어 평판 등록이 불가합니다." });
    }

    // 출석자만 평판 가능
    const isAttended = await chatModel.isUserAttended(roomId, userId);
    if (!isAttended) {
      return res.status(403).json({ error: "출석하지 않은 유저는 평가할 수 없습니다." });
    }

    const result = await chatModel.updateReputation(userId, reputation);
    return res.status(200).json({
      message: `${reputation === "warm" ? "따뜻함" : "차가움"} 평판이 적용되었습니다.`,
      like_temp: result.like_temp
    });
  } catch (err) {
    console.error("평판 등록 오류:", err);
    return res.status(500).json({ error: "평판 등록 실패" });
  }
});

// GET /chat/:roomId/allChat 방의 전체 채팅 메시지 조회
router.get("/:roomId/allChat", async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.user_id;

    if(!roomId) {
      return res.status(400).json({ error: "roomId가 필요합니다." });
    }

    if(!userId) {
      return res.status(400).json({ error: "사용자 정보가 필요합니다." });
    }

    // 참가 여부 확인
    const isParticipant = await chatModel.isUserParticipant(roomId, userId);

    if(!isParticipant) {
      return res.status(403).json({ error: "해당 방의 참가자가 아닙니다."});
    }

    const chatList = await chatModel.getAllChatByRoom(roomId);
    return res.status(200).json({ room_id: roomId, chat: chatList });
  } catch(err) {
    console.error("전체 채팅 조회 오류: ", err);
    return res.status(500).json({ error: "전체 채팅 조회 실패" });
  }
})

module.exports = router;
