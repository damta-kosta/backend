const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const emblemAssigner = require("../modules/emblemAssigner");

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

    const createdAt = new Date(user.create_at); // 최초 가입일
    const changedAt = new Date(user.changed_at); // 마지막 닉네임 변경일

    // 닉네임을 처음 설정한 경우 (== 최초 변경 허용)
    const isFirstChange = createdAt.getTime() === changedAt.getTime();

    // 이미 닉네임을 변경한 경우: 30일 경과 여부 확인
    const now = new Date();
    const daysDiff = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24)); // 일수 차이 계산

    if (!isFirstChange && daysDiff < 30) {
      return res.status(400).json({
        message: `닉네임은 30일마다 변경할 수 있습니다. (${30 - daysDiff}일 후 가능)`,
        nickname: user.user_nickname,
      });
    }

    // 닉네임 변경 처리
    const updated = await userModel.updateNickname(userId, newNickname);
    return res.json({
      message: "닉네임이 성공적으로 변경되었습니다.",
      nickname: updated.user_nickname,
    });

  } catch (err) {
    console.error("닉네임 변경 오류:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// PUT /users/me/user_bio - 한줄 소개 변경
router.put("/me/user_bio", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "유효하지 않은 토큰입니다." });

    const userId = req.user.user_id;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

    const bio = req.body.user_bio;
    if (typeof bio !== 'string' || bio.trim() === '') {
      return res.status(400).json({ message: "user_bio는 비어 있을 수 없습니다." });
    }

    await userModel.updateBio(userId, bio);
    return res.json({ message: "한줄 소개가 업데이트 되었습니다." });

  } catch (err) {
    console.error("한줄 소개 업데이트 오류: ", err.message, err.stack);
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
