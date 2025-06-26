const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const communityModel = {};

/**
 * 게시글 생성
 * 
 * @param {string} userId - 작성자 UUID
 * @param {string|null} title - 게시글 제목 (nullable)
 * @param {string} content - 게시글 본문
 * @param {string|null} imageBase64 - base64 인코딩 이미지 (nullable)
 * @returns {Object} 생성된 게시글의 ID
 */
communityModel.createPost = async(userId, title, content, imageBase64) => {
  const uuid = uuidv4();
  const now = getDate(0);

  const query = `
    INSERT INTO ${MAIN_SCHEMA}.community (
    community_id, community_writer, community_title,
    community_body, community_img, create_at, deleted
    ) VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING community_id
  `;

  const values = [uuid, userId, title, content, imageBase64 || "-", now];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * 게시글 목록 조회 (무한 스크롤 방식)
 * 
 * @param {string|null} cursor - 기준 시간 (created_at) - 이 시간 이전의 글을 조회
 * @param {number} limit - 조회할 게시글 수
 * @returns {Array} 게시글 리스트
 */
communityModel.getPosts = async (cursor, limit) => {
  let query = `
    SELECT c.community_id, c.community_title, c.community_body AS content, c.community_img AS imageBase64,
      p.user_nickname AS writer_nickname, c.create_at
    FROM ${MAIN_SCHEMA}.community c
    JOIN ${USER_SCHEMA}.profiles p ON c.community_writer = p.user_id
    WHERE c.deleted = false
  `;

  const values = [];

  if (cursor) {
    const cursorDate = new Date(cursor);
    values.push(cursorDate);
    query += `
      AND c.create_at < $1
    `;
  }

  query += `
    ORDER BY c.create_at DESC
    LIMIT $${values.length + 1}
  `;
  values.push(limit);

  console.log("Executing query:", query, "with values:", values);
  const result = await db.query(query, values);
  console.log("Query result:", result.rows);
  return result.rows;
};


/**
 * 게시글 삭제 (soft delete)
 * 
 * @param {string} communityId - 삭제할 게시글의 UUID
 * @returns {void}
 */
communityModel.deletePost = async(communityId) => {
  const query = `
    UPDATE ${MAIN_SCHEMA}.community
    SET deleted = true
    WHERE community_id = $1
  `;

  await db.query(query, [communityId]);
}

module.exports = communityModel;
