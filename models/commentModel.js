const db = require("../db");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const commentModel = {};

/**
 * 댓글 작성
 * 
 * @param {string} communityId - 대상 게시글 UUID
 * @param {string} userId - 댓글 작성자 UUID
 * @param {string} commentBody - 댓글 내용
 * @returns {Object} 생성된 댓글 ID
 */
commentModel.createComment = async (communityId, userId, commentBody) => {
  const  commentId = uuidv4();
  const now = getDate(0);

  const query = `
    INSERT INTO ${MAIN_SCHEMA}.comment (
      comment_id, community_id, user_id, comment_body, reply, create_at, deleted
    ) VALUES ($1, $2, $3, $4, null, $5, false) RETURNING comment_id
  `;

  const values = [commentId, communityId, userId, commentBody, now];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * 대댓글 작성
 * 
 * @param {string} communityId - 대상 게시글 UUID
 * @param {string} userId - 대댓글 작성자 UUID
 * @param {string} replyBody - 대댓글 내용
 * @param {string} parentCommentId - 부모 댓글 UUID
 * @returns {Object} 생성된 대댓글 ID
 */
commentModel.createReply = async (communityId, userId, replyBody, parentCommentId) => {
  const replyId = uuidv4();
  const now = getDate(0);

  const query = `
    INSERT INTO ${MAIN_SCHEMA}.comment (
      comment_id, community_id, user_id, comment_body, reply, create_at, deleted
    ) VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING comment_id
  `;

  const values = [replyId, communityId, userId, replyBody, parentCommentId, now];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * 댓글 및 대댓글 목록 조회 (커서 기반)
 *
 * @param {string} communityId - 대상 게시글 UUID
 * @param {string|null} cursor - 기준 시각 (이 시각보다 이전 댓글 조회)
 * @param {number} limit - 한 번에 불러올 댓글 수
 * @returns {Array} 댓글 및 대댓글 리스트 (시간순 ASC)
 */
commentModel.getComments = async (communityId, cursor, limit) => {
  let query = `
    SELECT c.comment_id, c.user_id, c.comment_body, c.reply, 
      c.create_at, c.deleted, p.user_nickname, p.user_profile_img
    FROM ${MAIN_SCHEMA}.comment c
    JOIN ${USER_SCHEMA}.profiles p ON c.user_id = p.user_id
    WHERE c.community_id = $1 AND c.deleted = false
  `;
  const values = [communityId];

  if(cursor) {
    values.push(new Date(cursor));
    query += ` AND c.create_at > $2`;
  }

  query += `
    ORDER BY create_at ASC
    LIMIT $${values.length + 1}
  `;

  values.push(limit);
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * 댓글 삭제 (soft delete)
 * 
 * @param {string} commentId - 삭제할 댓글 UUID
 * @param {string} userId - 요청자 UUID
 * @throws {Error} 작성자가 아닐 경우 403
 */
commentModel.deleteComment = async (commentId, userId) => {
  const checkQuery = `
    SELECT user_id FROM ${MAIN_SCHEMA}.comment
    WHERE comment_id = $1 AND deleted = false
  `;
  const result = await db.query(checkQuery, [commentId]);

  if(result.rowCount === 0) {
    const err = new Error("댓글이 존재하지 않거나 이미 삭제되었습니다.");
    err.status = 404;
    throw err;
  }

  if(result.rows[0].user_id !== userId) {
    const err = new Error("본인의 댓글만 삭제할 수 있습니다.");
    err.status = 403;
    throw err;
  }

  const deleteQuery = `
    UPDATE ${MAIN_SCHEMA}.comment
    SET deleted = true
    WHERE comment_id = $1
  `;
  await db.query(deleteQuery, [commentId]);
};

/**
 * 답글 삭제 (soft delete)
 * 
 * @param {string} replyId - 삭제할 대댓글 UUID
 * @param {string} userId - 요청자 UUID
 * @throws {Error} 작성자가 아닐 경우 403
 */
commentModel.deleteReply = async (replyId, userId) => {
  const checkQuery = `
    SELECT user_id FROM ${MAIN_SCHEMA}.comment
    WHERE comment_id = $1 AND deleted = false
  `;
  const result = await db.query(checkQuery, [replyId]);

  if (result.rowCount === 0) {
    const err = new Error("답글이 존재하지 않거나 이미 삭제되었습니다.");
    err.status = 404;
    throw err;
  }

  if (result.rows[0].user_id !== userId) {
    const err = new Error("본인의 답글만 삭제할 수 있습니다.");
    err.status = 403;
    throw err;
  }

  const deleteQuery = `
    UPDATE ${MAIN_SCHEMA}.comment
    SET deleted = true
    WHERE comment_id = $1
  `;
  await db.query(deleteQuery, [replyId]);
};

module.exports = commentModel;
