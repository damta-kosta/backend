const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");

require("dotenv").config();

router.get("/kakao/login", (req, res) => {
  const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}`;
  res.redirect(kakaoAuthURL);
});

router.get("/kakao/callback", async (req, res) => {
  const code = req.query.code;

  try {
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

    const userResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
    });

    const kakaoId = userResponse.data.id;
    const nickname = userResponse.data.kakao_account.profile.nickname;

    // DB에서 회원 조회 또는 신규 가입 처리 후 JWT  발급
    const token = jwt.sign({ kakaoId }, process.env.JWT_SECRET, { expiresIn: "7d"});

    res.json({ token, kakaoId, nickname });
  } catch(err) {
    console.error(err);
    res.status(500).send("Kakao login failed");
  }
});

module.exports = router;
