const db = require("../db");
const fs = require("fs").promises;
const path = require("path");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const roomListModel = {};

/**
 * 방 리스트 조회 (커서 기반 페이지네이션 - latest | scheduled 지원)
 * 
 * @param {string} sort - 'latest' | 'scheduled'
 * @param {string|null} cursor - ISO8601 문자열 (정렬 필드 기준)
 * @param {number} limit - 불러올 개수
 */
roomListModel.getRoomList = async ({ sort, cursor, limit }) => {
  let sortField;
  if (sort === "latest") {
    sortField = "room_created_at";
  } else if (sort === "scheduled") {
    sortField = "room_scheduled";
  } else {
    throw new Error("Invalid sort option");
  }

  let whereClause = `WHERE r.deleted = FALSE`;
  const values = [];

  if (cursor) {
    const cursorDate = new Date(cursor);
    values.push(cursorDate);
    whereClause += ` AND r.${sortField} < $1`;
  }

  const query = `
    SELECT 
      r.room_id,
      r.room_title,
      r.room_description,
      r.room_scheduled,
      r.room_created_at,
      r.room_thumbnail_img,
      r.max_participants,
      p.user_nickname AS host_nickname,
      json_agg(
        DISTINCT jsonb_build_object(
          'user_id', pr.participants_user_id,
          'user_profile_img', pp.user_profile_img
        )
      ) FILTER (WHERE pr.participants_user_id IS NOT NULL) AS participant_profiles
    FROM ${MAIN_SCHEMA}.room_info r
    JOIN ${USER_SCHEMA}.profiles p ON r.room_host = p.user_id
    LEFT JOIN ${MAIN_SCHEMA}.participants pr ON r.room_id = pr.room_id
    LEFT JOIN ${USER_SCHEMA}.profiles pp ON pr.participants_user_id = pp.user_id
    ${whereClause}
    GROUP BY r.room_id, p.user_nickname
    ORDER BY r.${sortField} DESC
    LIMIT $${values.length + 1}
  `;

  values.push(limit + 1);

  const { rows } = await db.query(query, values);

  const hasNext = rows.length > limit;
  const trimmed = hasNext ? rows.slice(0, limit) : rows;

  const nextCursor = hasNext
    ? trimmed[trimmed.length - 1][sortField].toISOString()
    : null;

  const result = trimmed.map(room => {
    const participant_profiles = room.participant_profiles || [];
    return {
      room_id: room.room_id,
      title: room.room_title,
      description: room.room_description,
      room_scheduled: room.room_scheduled,
      created_at: room.room_created_at,
      thumbnail_path: room.room_thumbnail_img,
      participant_profiles,
      participant_count: participant_profiles.length,
      max_participants: room.max_participants,
      host_nickname: room.host_nickname
    };
  });

  return {
    rooms: result,
    hasNext,
    nextCursor
  };
};

/**
 * 썸네일 이미지 경로를 base64로 변환
 * 
 * @param {string} filePath 
 * @returns {Promise<string|null>}
 */
roomListModel.encodeImageToBase64 = async (filePath) => {
  try {
    if (!filePath || filePath === "-") return null;
    const imageBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).substring(1);
    return `data:image/${ext};base64,${imageBuffer.toString("base64")}`;
  } catch (err) {
    console.error("이미지 변환 오류:", err);
    return null;
  }
};

module.exports = roomListModel;
