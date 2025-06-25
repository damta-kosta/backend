const db = require("../db/index");
const { getDate } = require("../modules/getData");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const userModel = {};

// 유저 ID로 프로필 + 엠블럼 정보 조회
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

// 닉네임 변경 가능 여부 확인용 (최근 변경일자 확인)
userModel.getNicknameChangeInfo = async(userId) => {
  const query = `
    SELECT user_nickname, changed_at FROM ${USER_SCHEMA}.profiles
    WHERE user_id = $1 AND deleted = false
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0];
};

// 닉네임 변경
userModel.updateNickname = async(userId, nickname) => {
  const now =getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles
    SET user_nickname = $1, changed_at = $2, update_at = $2
    WHERE user_id = $3 RETURNING user_nickname
  `;

  const result = await db.query(query, [nickname, now, userId]);
  return result.rows[0];
};

// 자기소개 변경
userModel.updateBio = async(userId, user_bio) => {
  const now = getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles SET user_bio = $1, update_at = $2
    WHERE user_id = $3
  `;

  return db.query(query, [user_bio, now, userId]);
};

// 위치정보 변경
userModel.updateLocation = async(userId, location) => {
  const now = getDate(0);
  const query = `
    UPDATE ${USER_SCHEMA}.profiles SET location = $1, update_at = $2
    WHERE user_id = $3
  `;

  return db.query(query, [location, now, userId]);
};

// 회원 탈퇴 (soft delete)
userModel.softDelete = async(userId, deleted) => {
  const now = getDate(0);
  const query = `
  UPDATE ${USER_SCHEMA}.profiles SET deleted = $1, update_at = $2
  WHERE user_id = $3
  `;

  return db.query(query, [deleted, now, userId]);
};

module.exports = userModel;
