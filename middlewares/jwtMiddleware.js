const jwt = require("jsonwebtoken");

const jwtMiddleware = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 없습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "토큰이 만료되었습니다." });
    } else {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
  }
};

module.exports = jwtMiddleware;
