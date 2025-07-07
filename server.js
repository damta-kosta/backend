const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");
const chatSocket = require("./socket/chatSocket");

require("dotenv").config();

const server = http.createServer(app); // express app으로 http 서버 생성

const io = new Server(server, {
  cors: {
    origin: "*", // 프론트 도메인으로 제한 가능
    methods: ["GET", "POST"]
  }
});

chatSocket(io); // socket 이벤트 바인딩

const HOST = process.env.HOST;
const PORT = process.env.PORT;

server.listen(PORT, HOST, () => {
  console.log(`API + Socket.IO server is running on http://${HOST}:${PORT}`);
});
