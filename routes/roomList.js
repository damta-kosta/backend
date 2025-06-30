const express = require("express");
const router = express.Router();
const roomListModel = require("../models/roomListModel");
const fs = require("fs").promises;
const path = require("path");

// 썸네일 base64 변환 함수
async function encodeImageToBase64(filePath) {
  try {
    if (!filePath || filePath === "-") return null;
    const imageBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).substring(1);
    return `data:image/${ext};base64,${imageBuffer.toString("base64")}`;
  } catch (err) {
    console.error("이미지 변환 오류:", err);
    return null;
  }
}

// GET /roomList/rooms
router.get("/rooms", async (req, res) => {
  try {
    const {
      sort = "latest",
      cursor = null,
      limit = 10
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

    const result = await roomListModel.getRoomList({
      sort,
      cursor,
      limit: parsedLimit
    });

    const roomsWithThumbnail = await Promise.all(result.rooms.map(async (room) => {
      const base64Img = await encodeImageToBase64(room.thumbnail_path);
      return {
        room_id: room.room_id,
        title: room.title,
        description: room.description,
        room_scheduled: room.room_scheduled,
        thumbnailBase64: base64Img,
        current_participants: room.current_participants,
        max_participants: room.max_participants,
        host_nickname: room.host_nickname
      };
    }));

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
