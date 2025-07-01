const express = require("express");
const router = express.Router();
const roomListModel = require("../models/roomListModel");

// GET /roomList/rooms
router.get("/rooms", async (req, res) => {
  try {
    const {
      sort = "latest",
      cursor = null,
      limit = 10
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

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

module.exports = router;
