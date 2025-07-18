const { db } = require("../db/index");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const userModel = {};

/**
 * 유저 ID로 프로필 + 엠블럼 정보 + 참여 중인 방 수 조회
 * @param {string} userId - 사용자 UUID
 * @returns {Object|null} 사용자 정보 + 엠블럼 정보 + join_state
 */
userModel.getUserById = async (userId) => {
  const profileQuery = `
    SELECT p.*, e.emblem_name, e.emblem_description
    FROM ${USER_SCHEMA}.profiles p
    LEFT JOIN ${MAIN_SCHEMA}.emblems e ON p.emblem_id = e.emblem_id
    WHERE p.user_id = $1 AND p.deleted = false
  `;

  const profileResult = await db.query(profileQuery, [userId]);
  const user = profileResult.rows[0];
  if (!user) return null;

  // 진행 중인 방만 기준으로 join_state 계산
  const activeRoomQuery = `
    SELECT COUNT(DISTINCT r.room_id) AS count
    FROM ${MAIN_SCHEMA}.room_info r
    LEFT JOIN ${MAIN_SCHEMA}.participants p ON r.room_id = p.room_id
    WHERE r.deleted = false AND r.room_ended_at > NOW()
    AND (r.room_host = $1 OR p.participants_user_id = $1)
  `;

  const roomResult = await db.query(activeRoomQuery, [userId]);
  const join_state = parseInt(roomResult.rows[0].count);

  return {
    ...user,
    join_state,
  };
};

/**
 * 닉네임 변경 가능 여부 확인용 (최근 변경일자 확인)
 * @param {string} userId - 사용자 UUID
 * @returns {Object} 현재 닉네임, changed_at(마지막 변경 시각)
 */
userModel.getNicknameChangeInfo = async(userId) => {
  const query = `
    SELECT user_nickname, changed_at, create_at FROM ${USER_SCHEMA}.profiles
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
  const now = new Date();
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
  const now = new Date();
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
  const now = new Date();
  const query = `
    UPDATE ${USER_SCHEMA}.profiles SET location = $1, update_at = $2
    WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [location, now, userId]);
};

/**
 * 프로필 이미지 변경
 * @param {string} userId - 사용자 UUID
 * @param {string} userProfileImg - base64 또는 URL 형식의 이미지 데이터
 * @returns {Promise}
 */
userModel.updateProfileImage = async(userId, userProfileImg) => {
  const now = new Date();
  const query = `
    UPDATE ${USER_SCHEMA}.profiles
    SET user_profile_img = $1, update_at = $2
    WHERE user_id = $3 AND deleted = false
  `;

  return db. query(query, [userProfileImg, now, userId]);
}

/**
 * 임시로 like_temp 변경
 * @param {string} userId - 사용자 UUID
 * @param {number} likeTemp - 새로 설정할 like_temp
 * @returns {Promise}
 */
userModel.updateLikeTemp = async (userId, likeTemp) => {
  const now = new Date();
  const query = `
    UPDATE ${USER_SCHEMA}.profiles
    SET like_temp = $1, update_at = $2
    WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [likeTemp, now, userId]);
};

/**
 * 회원 탈퇴 (Soft Delete 처리)
 * @param {string} userId - 사용자 UUID
 * @param {boolean} deleted - 탈퇴 여부 (true)
 * @returns {Promise}
 */
userModel.softDelete = async(userId, deleted) => {
  const now = new Date();
  const query = `
  UPDATE ${USER_SCHEMA}.profiles SET deleted = $1, update_at = $2
  WHERE user_id = $3 AND deleted = false
  `;

  return db.query(query, [deleted, now, userId]);
};

module.exports = userModel;
