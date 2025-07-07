const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const emblemAssigner = require("../modules/emblemAssigner");
const { getDate } = require("../modules/getData");

// GET /users/me - 현재 로그인한 유저의 프로필 정보 + 엠블럼 조회
router.get("/me", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const user = await userModel.getUserById(req.user.user_id);
    if (!user) return res.status(404).json({ message: "유저 없음" });

    const { emblem_id, emblem_name, emblem_description, ...rest } = user;
    const emblem = await emblemAssigner.getEmblemInfoByLikeTemp(user.like_temp);

    return res.json({
      ...rest,
      emblem: emblem ? {
        emblem_id: emblem.emblem_id,
        emblem_name: emblem.emblem_name,
        emblem_description: emblem.emblem_description
      } : null
    });
  } catch (err) {
    console.error("GET /users/me error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// PUT /users/me/nickname - 닉네임 변경 (30일 제한)
router.put("/me/nickname", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const userId = req.user.user_id;
    const newNickname = req.body.nickname;

    const user = await userModel.getNicknameChangeInfo(userId);
    if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

    const changedAt = new Date(user.changed_at);
    const limitStr = getDate(-30);
    const limitDate = new Date(
      `${limitStr.slice(0, 4)}-${limitStr.slice(4, 6)}-${limitStr.slice(6, 8)}T${limitStr.slice(9)}Z`
    );

    if (user.user_nickname && changedAt > limitDate) {
      return res.status(400).json({ message: "닉네임 변경에 실패 했습니다.", nickname: newNickname });
    }

    const updated = await userModel.updateNickname(userId, newNickname);
    return res.json({ message: "닉네임이 성공적으로 변경되었습니다.", nickname: updated.user_nickname });
  } catch (err) {
    console.error("PUT /me/nickname error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// PUT /users/me/user_bio - 한줄 소개 변경
router.put("/me/user_bio", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const user = await userModel.getUserById(req.user.user_id);
    if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

    await userModel.updateBio(req.user.user_id, req.body.user_bio);
    return res.json({ message: "한줄 소개가 업데이트 되었습니다." });
  } catch (err) {
    console.error("PUT /me/user_bio error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// POST /users/me/location - 위치 정보 변경
router.post("/me/location", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const user = await userModel.getUserById(req.user.user_id);
    if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

    await userModel.updateLocation(req.user.user_id, req.body.location);
    return res.json({ message: "위치가 업데이트 되었습니다." });
  } catch (err) {
    console.error("POST /me/location error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /users/me/delete - 회원 탈퇴 처리 (soft delete)
router.patch("/me/delete", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const user = await userModel.getUserById(req.user.user_id);
    if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

    await userModel.softDelete(req.user.user_id, req.body.deleted);
    return res.json({ message: "계정이 탈퇴 처리 되었습니다." });
  } catch (err) {
    console.error("PATCH /me/delete error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// GET /users/me/rooms - 유저가 참여 중인 방 리스트
router.get("/me/rooms", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const userId = req.user.user_id;
    const result = await userModel.getMyActiveRooms(userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("GET /me/rooms error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
