const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const emblemAssigner = require("../modules/emblemAssigner");
const { getDate } = require("../modules/getData");

// GET /users/me 현재 로그인한 유저의 프로필 정보 + 엠블럼 조회
router.get("/me", async (req, res) => {
  try {
    const user = await userModel.getUserById(req.user.user_id);
    if(!user) return res.status(404).json({ message: "유저 없음" });

    const { emblem_id, emblem_name, emblem_description, ...rest } = user;

    // like_temp 기준 엠블럼 정보 조회
    const emblem = await emblemAssigner.getEmblemInfoByLikeTemp(user.like_temp);

    res.json({
      ...rest,
      emblem: emblem ? {
        emblem_id: emblem.emblem_id,
        emblem_name: emblem.emblem_name,
        emblem_description: emblem.emblem_description
      } : null
    });
  }catch(err) {
    console.error("GET /users/me error:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// PUT /users/me/nickname 닉네임 변경 (한번 변경후 30일 제한)
router.put("/me/nickname", async (req, res) => {
  const userId = req.user.user_id;
  const newNickname = req.body.nickname;

  const user = await userModel.getNicknameChangeInfo(userId);
  if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

  const changedAt = new Date(user.changed_at);
  const limitStr = getDate(-30);
  const limitDate = new Date(
    `${limitStr.slice(0, 4)}-${limitStr.slice(4, 6)}-${limitStr.slice(6, 8)}T${limitStr.slice(9)}Z`
  );

  // 30일 체크
  if(user.user_nickname && changedAt > limitDate) {
    return res.status(400).json({ message: "닉네임 변경에 실패 했습니다.", nickname: newNickname });
  }

  const updated = await userModel.updateNickname(userId, newNickname);
  res.json({ message: "닉네임이 성공적으로 변경되었습니다.", nickname: updated.user_nickname });
});

// PUT /users/me/user_bio 한줄 소개 변경
router.put("/me/user_bio", async (req, res) => {
  const user = await userModel.getUserById(req.user.user_id);
  if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

  await userModel.updateBio(req.user.user_id, req.body.user_bio);
  res.json({ message: "한줄 소개가 업데이트 되었습니다." });
});

// POST /users/me/location 위치 정보 변경
router.post("/me/location", async (req, res) => {
  const user = await userModel.getUserById(req.user.user_id);
  if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

  await userModel.updateLocation(req.user.user_id, req.body.location);
  res.json({ message: "위치가 업데이트 되었습니다." });
});

// PATCH /users/me/delete 회원 탈퇴 처리 (soft delete)
router.patch("/me/delete", async (req, res) => {
  const user = await userModel.getUserById(req.user.user_id);
  if (!user) return res.status(404).json({ message: "계정을 찾을 수 없습니다." });

  await userModel.softDelete(req.user.user_id, req.body.deleted);
  res.json({ message: "계정이 탈퇴 처리 되었습니다." });
});

// GET /users/me/rooms
router.get('/me/rooms', async (req, res) => {
  const userId = req.user.user_id;

  try {
    const result = await userModel.getMyActiveRooms(userId);
    res.status(200).json(result);
  } catch (err) {
    console.error("GET /users/me/rooms error:", err);
    res.status(500).json({ error: "참여 중인 방 조회에 실패했습니다." });
  }
});

module.exports = router;
