const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");

const self = {};

self.findUserBySocialId = async (socialId) => {
  const query = `SELECT * FROM user_schema.profiles WHERE social_id = $1 AND deleted = false`;
  const result = await db.query(query, [socialId]);
  return result.rows[0];
}

self.createUser = async (kakaoUser, profileData) => {
  const {
    id: social_id,
    kakao_account: {
      profile: { nickname: user_name }
    }
  } = kakaoUser;

  const {
    user_nickname,
    location,
    user_bio,
    user_profile_img
  } = profileData;

  const query = `
    INSERT INTO user_schema.profiles (
    user_id, provider, social_id, user_name, user_nickname,
    user_profile_img, user_role, join_state, location, create_at,
    update_at, nickname_update_at, deleted, emblem_id, like_temp, user_bio
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16
    ) RETURNING *;
  `;

  const values = [
    uuidv4(), "kakao", social_id.toString(), user_name,
    user_nickname, user_profile_img, "user", 0,
    location, new Date(), new Date(), null, false,
    null, 36.5, user_bio || null
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

module.exports = self;