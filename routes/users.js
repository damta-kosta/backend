const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const { getDate } = require("../modules/getData");

// 현재 로그인한 유저의 프로필 정보 + 엠블럼 조회
router.get("/me", async (req, res) => {
  const user = await userModel.getUserById(req.user.user_id);
  if(!user) return res.status(404).json({ message: "유저 없음" });

  const { emblem_id, emblem_name, emblem_description, ...rest } = user;
  res.json({
    ...rest,
    emblem: emblem_id ? {
      emblem_id,
      emblem_name,
      emblem_description
    } : null
  });
});

// 닉네임 변경 (한번 변경후 30일 제한)
router.put("/me/nickname", async (req, res) => {
  const userId = req.user.user_id;
  const newNickname = req.body.nickname;

  const user = await userModel.getNicknameChangeInfo(userId);

  const nowStr = getDate(0);
  const limitStr = getDate(-30);
  const changedAt = user.changed_at;

  // 30일 체크
  if(user.user_nickname && changedAt > limitStr) {
    return res.status(400).json({ message: "닉네임 변경에 실패 했습니다.", nickname: newNickname });
  }

  const updated = await userModel.updateNickname(userId, newNickname);
  res.json({ message: "닉네임이 성공적으로 변경되었습니다.", nickname: updated.user_nickname });
});

// 한줄 소개 변경
router.put("/me/user_bio", async (req, res) => {
  await userModel.updateBio(req.user.user_id, req.body.user_bio);
  res.json({ message: "한줄 소개가 업데이트 되었습니다." });
});

// 위치 정보 변경
router.post("/me/location", async (req, res) => {
  await userModel.updateLocation(req.user.user_id, req.body.location);
  res.json({ message: "위치가 업데이트 되었습니다." });
});

// 회원 탈퇴 처리 (soft delete)
router.patch("/me/delete", async (req, res) => {
  await userModel.softDelete(req.user.user_id, req.body.deleted);
  res.json({ message: "계정이 탈퇴 처리 되었습니다." });
});

module.exports = router;
