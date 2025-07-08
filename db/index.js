const {Pool} = require('pg');
require('dotenv').config();

const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWD,
    port: Number(process.env.DB_PORT)
});

// 연결될 때마다 타임존 설정
db.on('connect', (client) => {
    client.query("SET TIME ZONE 'Asia/Seoul'")
    .then(() => console.log("Timezone set to Asia/Seoul"))
    .catch(err => console.error("Failed to set timezone", err));
});

module.exports = db;