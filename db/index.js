const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWD,
    port: Number(process.env.DB_PORT)
});

// pool.query 그대로 사용하면서, 내부에서 timezone 설정 후 쿼리 실행하도록 래핑
const db = {
    query: async (text, params) => {
        const client = await pool.connect();
        try {
        await client.query("SET TIME ZONE 'Asia/Seoul'");
        const res = await client.query(text, params);
        return res;
        } finally {
        client.release();
        }
    }
};

module.exports = db;
