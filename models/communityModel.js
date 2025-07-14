const { db } = require("../db/index");
const { v4: uuidv4 } = require("uuid");

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
  const now = new Date();

  const checkUserQuery = `
    SELECT 1 FROM ${USER_SCHEMA}.profiles
    WHERE user_id = $1 AND deleted = false
  `;
  const checkResult = await db. query(checkUserQuery, [userId]);

  if(checkResult.rowCount === 0) {
    const error = new Error("작성 권한이 없습니다. (유효하지 않은 사용자)");
    error.status = 403;
    throw error;
  }

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
      p.user_nickname AS writer_nickname, p.user_profile_img AS writer_profile_img, c.create_at
    FROM ${MAIN_SCHEMA}.community c
    JOIN ${USER_SCHEMA}.profiles p ON c.community_writer = p.user_id
    WHERE p.deleted = false
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

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * 게시글 상세 조회
 * 
 * @param {string} communityId - 조회할 게시글의 UUID
 * @returns {Object|null} 게시글 상세 정보
 */
communityModel.getPostById = async  (communityId) => {
  const query = `
    SELECT c.community_id, c.community_title, c.community_body AS content, c.community_img AS imageBase64,
      p.user_nickname AS writer_nickname, p.user_profile_img AS writer_profile_img, c.create_at
    FROM ${MAIN_SCHEMA}.community c
    JOIN ${USER_SCHEMA}.profiles p ON c.community_writer = p.user_id
    WHERE c.community_id = $1 AND c.deleted = false
  `;

  const result = await db.query(query, [communityId]);

  if(result.rowCount === 0) return null;

  return result.rows[0];
};

/**
 * 게시글 삭제 (soft delete)
 * 
 * @param {string} communityId - 삭제할 게시글의 UUID
 * @returns {void}
 */
communityModel.deletePost = async(communityId, userId) => {
  const checkQuery = `
    SELECT community_writer FROM ${MAIN_SCHEMA}.community
    WHERE community_id = $1 AND deleted = false
  `;
  const checkResult = await db.query(checkQuery, [communityId]);

  if(checkResult.rowCount === 0) {
    const error = new Error("존재하지 않거나 이미 삭제된 게시글 입니다.");
    error.status = 404;
    throw error;
  }

  // const writerId = checkResult.rows[0].community_writer;
  // if(writerId !== userId) {
  //   const error = new Error("본인의 게시글만 삭제할 수 잇습니다.");
  //   error.status = 403;
  //   throw error;
  // }

  const query = `
    UPDATE ${MAIN_SCHEMA}.community
    SET deleted = true
    WHERE community_id = $1
  `;

  await db.query(query, [communityId]);
}

module.exports = communityModel;
