const express = require("express");
const router = express.Router();
const roomListModel = require("../models/roomListModel");

// GET /roomList/rooms
router.get("/rooms", async (req, res) => {
  try {
    const {
      sort = "latest",
      cursor = null,
      limit = 20
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 50);

    // 정렬 옵션 유효성 검증
    if (!["latest", "scheduled"].includes(sort)) {
      return res.status(400).json({ message: "Invalid sort option" });
    }

    // 방 리스트 조회
    const result = await roomListModel.getRoomList({
      sort,
      cursor,
      limit: parsedLimit
    });

    // 썸네일 변환 및 응답 구조 구성
    const roomsWithThumbnail = await Promise.all(
      result.rooms.map(async (room) => {
        const base64Img = await roomListModel.encodeImageToBase64(room.thumbnail_path);

        return {
          room_id: room.room_id,
          title: room.title,
          description: room.description,
          room_scheduled: room.room_scheduled,
          created_at: room.created_at,
          thumbnailBase64: base64Img,
          participant_profiles: room.participant_profiles || [],
          participant_count: room.participant_count || 0,
          max_participants: room.max_participants,
          host_nickname: room.host_nickname
        };
      })
    );

    res.json({
      rooms: roomsWithThumbnail,
      hasNext: result.hasNext,
      nextCursor: result.nextCursor
    });

  } catch (err) {
    console.error("GET /roomList/rooms 에러:", err);
    res.status(500).json({ message: "서버 에러" });
  }
});

// GET /roomList/rooms/:id
router.get("/rooms/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await roomListModel.getRoomDetail(roomId);

    if(!room) {
      return res.status(404).json({ message: "해당 방을 찾을 수 없습니다." });
    }

    const thumbnailBase64 = await roomListModel.encodeImageToBase64(room.room_thumbnail_img);

    res.json({
      room_id: room.room_id,
      title: room.room_title,
      description: room.room_description,
      room_scheduled: room.room_scheduled,
      created_at: room.room_created_at,
      thumbnailBase64,
      participants: room.participants || [],
      participant_count: room.participant_count,
      max_participants: room.max_participants,
      host_nickname: room.host_nickname
    });
  } catch (err) {
    console.error("방 조회 실패 에러: ", err);
    res.status(500).json({ message: "방 상세 조회 실패" });
  }
});

module.exports = router;
