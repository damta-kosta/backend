const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");
const myDate = require('../modules/getData');
const emblemAssigner = require("../modules/emblemAssigner");

require("dotenv").config();

// GET /auth/kakao/login 카카오 로그인 URL로 리디렉션
router.get("/kakao/login", (req, res) => {
  const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}`;
  res.redirect(kakaoAuthURL);
});

// GET /auth/kakao/callback?code= 콜백에서 사용자 인증, DB 조회, 신규 가입, JWT 발급
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

    // DB에서 사용자 조회
    let user = await authModel.findUserBySocialId(kakaoId);

    // 없으면 신규 가입
    if(!user) {
      user = await authModel.createUser(kakaoUser);
    }

    // JWT 발급
    const token = jwt.sign({ kakaoId, user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: "7d"});

    // 엠블럼 정보 추가
    const emblem = await emblemAssigner.getEmblemInfoByLikeTemp(user.like_temp);

    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  } catch(err) {
    console.error(err.response?.data || err);
    res.status(500).send("Kakao login failed");
  }
});

module.exports = router; 
