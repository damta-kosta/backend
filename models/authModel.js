const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");
require("dotenv").config();

const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const authModel = {};

authModel.findUserBySocialId = async (socialId) => {
  const query = `SELECT * FROM ${USER_SCHEMA}.profiles WHERE social_id = $1 AND deleted = false`;
  const result = await db.query(query, [socialId]);
  return result.rows[0];
}

authModel.createUser = async (kakaoUser) => {
  const {
    id: social_id,
    kakao_account: {
      profile: { nickname }
    }
  } = kakaoUser;

  const query = `
    INSERT INTO ${USER_SCHEMA}.profiles (
    user_id, social_id, user_name, user_nickname,
    join_state, create_at, update_at, changed_at,
    deleted, emblem_id, user_profile_img, user_bio
    ) VALUES (
      $1, $2, $3, $4, 
      $5, $6, $7, $8, 
      $9, $10, $11, $12
    ) RETURNING *;
  `;

  const values = [
    uuidv4(), 
    social_id.toString(), 
    nickname,
    nickname,
    0,
    getDate(0),
    getDate(0),
    getDate(0), 
    false,
    null,
    "-",
    ""
  ];

  try {
    const result = await db.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.log(err);
    return err;
  }

}

module.exports = authModel;
