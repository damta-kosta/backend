const express = require("express");
const router = express.Router();
const chatModel = require("../models/chatModel");
const roomsModel = require("../models/roomsModel");

// POST /chat/:roomId/chats 채팅 메시지 전송 (Socket.IO)
router.post("/:roomId/chats", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { chat_msg, message, chatMsg, chat_Msg } = req.body;
    const finalMsg = chat_msg || message || chatMsg || chat_Msg;
    const userId = req.user?.user_id;

    if (!finalMsg || !userId) {
      return res.status(400).json({ error: "메시지 또는 사용자 정보가 없습니다." });
    }

    const result = await chatModel.insertChat(roomId, userId, finalMsg);
    return res.status(201).json(result);
  } catch (err) {
    console.error("채팅 전송 오류:", err);
    return res.status(500).json({ error: "채팅 전송 실패" });
  }
});

// GET /chat/:roomId/messages?cursor=&limit= 현재 진행중인 채팅 메시지 무한커서방식
router.get("/:roomId/messages", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { cursor, limit = 30 } = req.query;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(400).json({ error: "사용자 인증 정보가 누락되었습니다." });
    }
    
    await roomsModel.checkAndEndRoomIfDue(roomId);

    const isParticipant = await chatModel.isUserParticipant(roomId, userId);
    if (!isParticipant) return res.status(403).json({ error: "방 참가자만 접근 가능" });

    let messages;

    if (cursor) {
      messages = await chatModel.getChatsBeforeCursor(roomId, cursor, limit);
    } else {
      messages = await chatModel.getRecentChats(roomId, limit);
    }

    res.status(200).json({ messages });
  } catch (err) {
    console.error("이전 메시지 조회 실패:", err);
    return res.status(500).json({ error: "메시지 조회 실패" });
  }
});

// PUT /chat/:roomId/check_attendance 방장이 출석 수동 체크
router.put("/:roomId/check_attendance", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { targetUserIds } = req.body;
    const hostUserId = req.user?.user_id;

    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return res.status(400).json({ error: "출석 대상 사용자 목록(targetUserIds)이 필요합니다." });
    }

    if (!hostUserId) {
      return res.status(400).json({ error: "요청한 사용자 정보(JWT)가 유효하지 않습니다." });
    }

    const result = await chatModel.markAttendanceBulk(roomId, targetUserIds, hostUserId);

    if (result?.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      message: "모든 출석 처리가 완료되었습니다.",
      updatedCount: result.updated
    });
  } catch (err) {
    console.error("수동 출석 체크 오류:", err);
    return res.status(500).json({ error: "수동 출석 체크 실패" });
  }
});

// POST /chat/:roomId/auto_attendance 자동 출석 체크
router.post("/:roomId/auto_attendance", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { attendedUsers } = req.body;
    const requestUserId = req.user?.user_id;

    if (!Array.isArray(attendedUsers)) {
      return res.status(400).json({ error: "attendedUsers 배열이 필요합니다." });
    }

    if (!requestUserId) {
      return res.status(400).json({ error: "사용자 인증 정보가 필요합니다." });
    }

    const result = await chatModel.autoAttendance(roomId, attendedUsers, requestUserId);

    if (result?.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.status(200).json({
      message: "자동 출석 체크 및 cold 평판 처리 완료",
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
    const userId = req.user?.user_id;
    
    if(!roomId) {
      return res.status(400).json({ error: "roomId가 필요합니다." });
    }

    if(!userId) {
      return res.status(400).json({ error: "사용자 정보가 필요합니다." });
    }

    // 참가자인지 확인
    const isParticipant = await chatModel.isUserParticipant(roomId, userId);

    if(!isParticipant) {
      return res.status(403).json({ error: "해당 방의 참가자가 아닙니다." });
    }

    const participants = await chatModel.getParticipantsByRoom(roomId);
    return res.status(200).json({ participants });
  } catch (err) {
    console.error("참가자 목록 조회 오류:", err);
    return res.status(500).json({ error: "참가자 목록 조회 실패" });
  }
});

// POST /chat/:userId/reputation?roomId=:roomId 모임 종료 후 유저 평가 (따뜻해 / 차가워)
router.post("/:userId/reputation", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reputation } = req.body;
    const { roomId } = req.query;
    const requestUserId = req.user?.user_id;

    const now = new Date();

    if (!["warm", "cold"].includes(reputation)) {
      return res.status(400).json({ error: "평판 값이 올바르지 않습니다." });
    }

    if (!requestUserId) {
      return res.status(400).json({ error: "JWT 사용자 정보가 유효하지 않습니다." });
    }

    if (requestUserId === userId) {
      return res.status(403).json({ error: "본인은 평가할 수 없습니다." });
    }

    //중복 평판 방지 캐시 검사
    const alreadyRated = chatModel.checkAlreadyRated(roomId, requestUserId, userId);
    if (alreadyRated) {
      return res.status(403).json({ error: "이미 해당 유저를 평가했습니다." });
    }

    // 출석 체크 완료 여부 확인
    const room = await chatModel.getRoomInfo(roomId);
    if (!room?.attendance_checked_at) {
      return res.status(403).json({ error: "아직 출석 체크가 완료되지 않았습니다." });
    }

    if (!room?.room_ended_at || new Date(now) > new Date(room.room_ended_at)) {
      return res.status(403).json({ error: "방이 이미 종료되어 평판 등록이 불가합니다." });
    }

    // 평가 대상자 출석 여부 확인
    const isTargetAttended = await chatModel.isUserAttended(roomId, userId);
    if (!isTargetAttended) {
      return res.status(403).json({ error: "출석하지 않은 유저는 평가 대상이 아닙니다." });
    }

    // 평가자 출석 여부 확인
    const isEvaluatorAttended = await chatModel.isUserAttended(roomId, requestUserId);
    if (!isEvaluatorAttended) {
      return res.status(403).json({ error: "출석하지 않은 유저는 평판을 남길 수 없습니다." });
    }

    const result = await chatModel.updateReputation(userId, reputation);

    // 평판 기록을 캐시에 저장
    chatModel.recordReputation(roomId, requestUserId, userId);

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
});

// GET /chat/myRooms - 유저가 참여 중인 모든 방 리스트 조회
// 삭제되지 않은 모든 방을 조회하며, 다음과 같은 방이 포함됩니다:
// - 사용자가 호스트인 방
// - 사용자가 참가자로 등록된 방
// - 방의 상태(예정/진행 중/종료됨)에 관계없이 모두 포함됨
// (단, 삭제된 방은 제외됨)
router.get("/myRooms", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const userId = req.user.user_id;
    const result = await chatModel.getMyActiveRooms(userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("GET /me/rooms error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
