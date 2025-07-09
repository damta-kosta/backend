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
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error("유효하지 않은 토큰입니다."));
  }
}

function chatSocket(io) {
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log("소켓 연결됨:", socket.id);

    // 방 입장
    socket.on("joinRoom", async ({ roomId, userId }) => {
      if (!roomId || !userId) {
        return socket.emit("errorMessage", "roomId 또는 userId가 누락되었습니다.");
      }

      try {
        const isBlocked = await chatModel.isBlacklisted(roomId, userId);
        if (isBlocked) {
          return socket.emit("errorMessage", "블랙리스트에 등록된 유저입니다.");
        }

        const roomInfo = await chatModel.getRoomInfo(roomId);

        const now = new Date();
        const roomScheduled = new Date(roomInfo.room_scheduled);
        const roomEndTime = new Date(
          roomScheduled.getFullYear(),
          roomScheduled.getMonth(),
          roomScheduled.getDate(),
          23, 59, 59, 999 // 당일 23:59:59.999
        );

        const isEnded = !!roomInfo?.room_ended_at || now > roomEndTime;

        if (isEnded) {
          socket.emit("roomEnded", { message: "이 방은 종료되어 채팅은 불가능합니다." });
        }

        socket.join(roomId);
        socket.data.userId = userId;
        socket.data.roomId = roomId;
        socket.data.isEnded = isEnded;
        socket.data.roomTitle = roomInfo.title;

        // 입장 로그 출력
        console.log(`${socket.data.user.user_nickname}님이 '${roomInfo.title}' 방에 입장했습니다.`);

        emitRoomUserCount(io, roomId);
        emitRoomUserList(io, roomId);
      } catch (err) {
        console.error("joinRoom 오류:", err);
        socket.emit("errorMessage", "방 입장 중 오류 발생");
      }
    });

    // 입력 중 타이핑 알림
    socket.on("typing", ({ roomId }) => {
      if (roomId && socket.data.user) {
        socket.to(roomId).emit("userTyping", {
          user_nickname: socket.data.user.user_nickname
        });
      }
    });

    // 채팅 메시지 수신
    socket.on("chatMessage", async ({ roomId, userId, message, chat_msg, chatMsg, chat_Msg }) => {
      const finalMessage = message || chat_msg || chatMsg || chat_Msg;

      if (!finalMessage?.trim()) return; // 빈 메시지 무시

      if (socket.data.isEnded) {
        return socket.emit("errorMessage", "이미 종료된 방에서는 채팅할 수 없습니다.");
      }

      try {
        // 채팅 로그 출력
        console.log(`${socket.data.user.user_nickname}님의 메시지: ${finalMessage}`);

        const savedChat = await chatModel.insertChat(roomId, userId, finalMessage);
        io.to(roomId).emit("chatMessage", savedChat);
      } catch (err) {
        console.error("chatMessage 저장 오류:", err);
        socket.emit("errorMessage", "메시지 전송 실패");
      }
    });

    // 채팅 동기화 요청 (재접속 또는 초기 메시지 불러오기)
    socket.on("syncChat", async ({ roomId, cursor, limit = 30 }) => {
      if (!roomId || !socket.data.userId) {
        return socket.emit("errorMessage", "roomId 또는 사용자 정보가 없습니다.");
      }

      try {
        const isParticipant = await chatModel.isUserParticipant(roomId, socket.data.userId);
        if (!isParticipant) {
          return socket.emit("errorMessage", "방 참가자가 아닙니다.");
        }

        const messages = cursor
          ? await chatModel.getChatsBeforeCursor(roomId, cursor, limit)
          : await chatModel.getRecentChats(roomId, limit);

        socket.emit("syncChat", messages);
      } catch (err) {
        console.error("syncChat 오류:", err);
        socket.emit("errorMessage", "채팅 동기화 중 오류 발생");
      }
    });

    // 방 나가기
    socket.on("leaveRoom", async () => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId || !userId) return;

      try {
        const roomInfo = await chatModel.getRoomInfo(roomId);
        // 퇴장 로그 출력
        console.log(`${socket.data.user.user_nickname}님이 '${roomInfo.title}' 방에서 나갔습니다.`);

        socket.leave(roomId);
        emitRoomUserCount(io, roomId);
        emitRoomUserList(io, roomId);
      } catch (err) {
        console.error("leaveRoom 처리 중 오류:", err);
        socket.emit("errorMessage", "방 나가기 처리 중 오류 발생");
      }
    });

    // 연결 해제
    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        emitRoomUserCount(io, roomId);
        emitRoomUserList(io, roomId);
      }
      console.log("소켓 연결 해제됨:", socket.id);
    });
  });
}

// 현재 room 내 접속자 수 계산 후 전송
async function emitRoomUserCount(io, roomId) {
  try {
    const clients = await io.in(roomId).fetchSockets();
    io.to(roomId).emit("roomUserCount", { count: clients.length });
  } catch (err) {
    console.error("emitRoomUserCount 오류:", err);
  }
}

// 현재 room 내 접속자 목록 전송
async function emitRoomUserList(io, roomId) {
  try {
    const sockets = await io.in(roomId).fetchSockets();
    const userList = sockets.map(s => ({
      user_id: s.data.user?.user_id,
      user_nickname: s.data.user?.user_nickname,
      user_profile_img: s.data.user?.user_profile_img
    }));
    io.to(roomId).emit("roomUserList", userList);
  } catch (err) {
    console.error("emitRoomUserList 오류:", err);
  }
}

module.exports = chatSocket;
