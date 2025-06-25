const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

require("dotenv").config();

// 카카오 로그인 URL로 리디렉션
router.get("/kakao/login", (req, res) => {
  const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}`;
  res.redirect(kakaoAuthURL);
});

// 콜백에서 사용자 인증, DB 조회, 신규 가입, JWT 발급
router.get("/kakao/callback", async (req, res) => {
  const code = req.query.code;

  try {
    // 인증 코드로 access_token 요청
    const tokenResponse = await axios.post(
      `https://kauth.kakao.com/oauth/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // access_token으로 사용자 정보 조회
    const userResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
    });

    const kakaoUser = userResponse.data;
    const kakaoId = kakaoUser.id;
    const userName = kakaoUser.kakao_account.profile.nickname;

    // DB에서 사용자 조회
    let user = await userModel.findUserBySocialId(kakaoId);

    // 없으면 신규 가입
    if(!user) {
      return res.status(200).json({
        message: "신규 사용자입니다. 추가 정보를 입력해주세요.",
        kakaoId,
        user_name: userName
      });
    }

    // JWT 발급
    const token = jwt.sign({ kakaoId }, process.env.JWT_SECRET, { expiresIn: "7d"});

    res.json({ accessToken: token, user });
  } catch(err) {
    console.error(err.response?.data || err);
    res.status(500).send("Kakao login failed");
  }
});

module.exports = router; 
