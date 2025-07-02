const express = require("express");
const router = express.Router();
const chatModel = require("../models/chatModel");

// POST /chat/:roomId/chats 채팅 메세지 전송 (Socket.IO)
router.post("/:roomId/chat", async (req, res) => {

});

// PUT /chat/:roomId/check_attendance 방장이 수동 출석 체크
router.put("/:roomId/check_attendance", async (req, res) => {

});

// POST /chat/:roomId/auto_attendance 자동 출석 체크
router.post("/:roomId/auto_attendance", async (req, res) => {

});

// PATCH /chat/:roomId/status 채팅종료 (23:59분 기준)
router.patch("/:roomId/status", async (req, res) => {

});

// GET /chat/:roomId/allChat 채팅 전부 조회
router.get("/:roomId/allChat", async (req, res) => {

});

// POST /chat/:userId/reputation 모임 종료 후 유저 평가 (따뜻해 / 차가워)
router.post("/:userId/reputation", async (req, res) => {

});

module.exports = router;
