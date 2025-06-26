const db = require("../db/index");
const { getDate } = require("../modules/getData");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const userModel = {};

/**
 * 유저 ID로 프로필 + 엠블럼 정보 조회
 * @param {string} userId - 사용자 UUID
 * @returns {Object} 사용자 정보 + 엠블럼 정보 (LEFT JOIN)
 */
userModel.getUserById = async(userId) => {
  const query = `
    SELECT p.*, e.emblem_name, e.emblem_description
    FROM ${USER_SCHEMA}.profiles p
    LEFT JOIN ${MAIN_SCHEMA}.emblems e ON p.emblem_id = e.emblem_id
    WHERE p.user_id = $1 AND p.deleted = false
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0];
};

/**
 * 닉네임 변경 가능 여부 확인용 (최근 변경일자 확인)
 * @param {string} userId - 사용자 UUID
 * @returns {Object} 현재 닉네임, changed_at(마지막 변경 시각)
 */
userModel.getNicknameChangeInfo = async(userId) => {
  const query = `
    SELECT user_nickname, changed_at FROM ${USER_SCHEMA}.profiles
    WHERE user_id = $1 AND deleted = false
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0];
};

/**
 * 닉네임 변경 (30일 제한 고려는 라우터에서 처리)
 * @param {string} userId - 사용자 UUID
 * @param {string} nickname - 새 닉네임
 * @returns {Object} 변경된 닉네임
 */
userModel.updateNickname = async(userId, nickname) => {
  const now =getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles
    SET user_nickname = $1, changed_at = $2, update_at = $2
    WHERE user_id = $3 AND deleted = false RETURNING user_nickname
  `;

  const result = await db.query(query, [nickname, now, userId]);
  return result.rows[0];
};

/**
 * 자기소개 업데이트
 * @param {string} userId - 사용자 UUID
 * @param {string} user_bio - 수정할 한줄소개
 * @returns {Promise}
 */
userModel.updateBio = async(userId, user_bio) => {
  const now = getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles SET user_bio = $1, update_at = $2
    WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [user_bio, now, userId]);
};

/**
 * 위치 정보 업데이트
 * @param {string} userId - 사용자 UUID
 * @param {string} location - 새 위치 정보
 * @returns {Promise}
 */
userModel.updateLocation = async(userId, location) => {
  const now = getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles SET location = $1, update_at = $2
    WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [location, now, userId]);
};

/**
 * 회원 탈퇴 (Soft Delete 처리)
 * @param {string} userId - 사용자 UUID
 * @param {boolean} deleted - 탈퇴 여부 (true)
 * @returns {Promise}
 */
userModel.softDelete = async(userId, deleted) => {
  const now = getDate(0);
  const query = `
  UPDATE ${USER_SCHEMA}.profiles SET deleted = $1, update_at = $2
  WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [deleted, now, userId]);
};

module.exports = userModel;