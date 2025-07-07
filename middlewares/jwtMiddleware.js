const jwt = require("jsonwebtoken");

const jwtMiddleware = (req, res, next) => {
  // 1. 쿠키에서 토큰 가져오기
  let token = req.cookies?.token;

  // 2. Authorization 헤더에서도 시도 (Bearer 토큰 허용)
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 3. 토큰이 없으면 에러
  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 없습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next(); // 다음 미들웨어 or 라우터로 진행
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "토큰이 만료되었습니다." });
    } else {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
  }
};

module.exports = jwtMiddleware;
