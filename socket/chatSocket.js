const chatModel = require("../models/chatModel");
const jwt = require("jsonwebtoken");

// 소켓 전용 JWT 인증 미들웨어
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("인증 토큰이 없습니다."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = decoded; // 인증된 사용자 정보 저장
    next();
  } catch (err) {
    return next(new Error("유효하지 않은 토큰입니다."));
  }
}

function chatSocket(io) {
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log("소켓이 연결되었습니다:", socket.id);

    // 방 입장
    socket.on("joinRoom", async ({ roomId, userId }) => {
      // 블랙리스트 검사
      const isBlocked = await chatModel.isBlacklisted(roomId, userId);
      if (isBlocked) {
        socket.emit("error", "블랙리스트에 등록된 유저입니다.");
        return;
      }

      socket.join(roomId);
      socket.data.userId = userId;
      socket.data.roomId = roomId;
      console.log(`유저 ${userId}님이 ${roomId}에 참여 하였습니다.`);

      emitRoomUserCount(io, roomId);
      emitRoomUserList(io, roomId);
    });

    // 입력 중 타이핑 알림
    socket.on("typing", ({ roomId, userId }) => {
      socket.to(roomId).emit("userTyping", { userId });
    });

    // 채팅 메시지 수신
    socket.on("chatMessage", async ({ roomId, userId, message }) => {
      try {
        const savedChat = await chatModel.insertChat(roomId, userId, message);
        io.to(roomId).emit("chatMessage", savedChat);
      } catch(err) {
        console.error("채팅 저장 오류:", err);
        socket.emit("errorMessage", "메시지 전송 실패");
      }
    });

    // 방 나가기
    socket.on("leaveRoom", () => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      if (roomId) {
        socket.leave(roomId);
        console.log(`유저 ${userId}님이 ${roomId}을 떠났습니다.`);
        emitRoomUserCount(io, roomId);
        emitRoomUserList(io, roomId);
      }
    });

    // 연결 해제
    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        emitRoomUserCount(io, roomId);
        emitRoomUserList(io, roomId);
      }
      console.log("소켓이 해제 되었습니다:", socket.id);
    });
  });
}

// 현재 room 내 접속자 수 계산 후 전송
async function emitRoomUserCount(io, roomId) {
  const clients = await io.in(roomId).fetchSockets();
  const count = clients.length;
  io.to(roomId).emit("roomUserCount", { count });
}

// 현재 room 내 접속자 목록 전송
async function emitRoomUserList(io, roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  const userList = sockets.map(s => ({
    user_id: s.data.user?.user_id,
    user_nickname: s.data.user?.user_nickname,
    user_profile_img: s.data.user?.user_profile_img
  }));
  io.to(roomId).emit("roomUserList", userList);
}

module.exports = chatSocket;
