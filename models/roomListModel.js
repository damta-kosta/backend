const { db }  = require("../db");
const fs = require("fs").promises;
const path = require("path");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const roomListModel = {};

/**
 * 썸네일 이미지 경로를 base64로 변환
 * 
 * @param {string} filePathOrBase64 
 * @returns {Promise<string|null>}
 */
roomListModel.encodeImageToBase64 = async (filePathOrBase64) => {
  try {
    if (!filePathOrBase64 || filePathOrBase64 === "-" || filePathOrBase64.startsWith("data:image/")) {
      // 이미 base64 문자열이거나 유효하지 않은 경우 그대로 반환
      return filePathOrBase64 === "-" ? null : filePathOrBase64;
    }

    // 그 외에는 경로로 간주하고 파일을 읽어 변환
    const imageBuffer = await fs.readFile(filePathOrBase64);
    const ext = path.extname(filePathOrBase64).substring(1);
    return `data:image/${ext};base64,${imageBuffer.toString("base64")}`;
  } catch (err) {
    console.error("이미지 변환 오류:", err);
    return null;
  }
};


/**
 * 방 리스트 조회 (커서 기반 페이지네이션 - latest | scheduled 지원)
 * 
 * @param {string} sort - 'latest' | 'scheduled'
 * @param {string|null} cursor - ISO8601 문자열 (정렬 필드 기준)
 * @param {number} limit - 불러올 개수
 */
roomListModel.getRoomList = async ({ sort, cursor, limit }) => {
  let sortField, sortOrder;
  if (sort === "latest") {
    sortField = "room_created_at";
    sortOrder = "DESC";
  } else if (sort === "scheduled") {
    sortField = "room_scheduled";
    sortOrder = "ASC";
  } else {
    throw new Error("유효하지않은 sort option 입니다.");
  }

  let whereClause = `WHERE r.deleted = FALSE AND r.room_scheduled >= now()`;
  const values = [];

  if (cursor) {
    const cursorDate = new Date(cursor);
    values.push(cursorDate);
    whereClause += ` AND r.${sortField} < $1`;
  }

  const query = `
    SELECT r.room_id, r.room_title, r.room_description, r.room_scheduled,
      r.room_created_at, r.room_thumbnail_img, r.max_participants, p.user_nickname AS host_nickname,
      json_agg(
        DISTINCT jsonb_build_object(
          'user_id', pr.participants_user_id,
          'user_profile_img', pp.user_profile_img
        )
      ) FILTER (WHERE pr.participants_user_id IS NOT NULL) AS participant_profiles
    FROM ${MAIN_SCHEMA}.room_info r
    JOIN ${USER_SCHEMA}.profiles p ON r.room_host = p.user_id
    LEFT JOIN ${MAIN_SCHEMA}.participants pr ON r.room_id = pr.room_id
    LEFT JOIN ${USER_SCHEMA}.profiles pp ON pr.participants_user_id = pp.user_id ${whereClause}
    GROUP BY r.room_id, p.user_nickname
    ORDER BY r.${sortField} ${sortOrder}
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
 * 특정 방의 상세 정보 조회
 * 
 * @function getRoomDetail
 * @memberof roomListModel
 * @param {string} roomId - 조회할 방의 UUID
 * @returns {Promise<Object|null>} 방 상세 정보 객체 또는 null  
 */
roomListModel.getRoomDetail = async (roomId) => {
  const query = `
    SELECT r.room_id, r.room_title, r.room_description, r.room_scheduled,
      r.room_created_at, r.room_thumbnail_img, r.max_participants,
      p.user_nickname AS host_nickname,
      COUNT(DISTINCT pr.participants_user_id)::INT AS participant_count,
      json_agg(
        DISTINCT jsonb_build_object(
          'user_id', pp.user_id,
          'user_nickname', pp.user_nickname,
          'user_profile_img', pp.user_profile_img
        )
      ) FILTER (WHERE pr.participants_user_id IS NOT NULL) AS participants
    FROM ${MAIN_SCHEMA}.room_info r
    JOIN ${USER_SCHEMA}.profiles p ON r.room_host = p.user_id
    LEFT JOIN ${MAIN_SCHEMA}.participants pr ON r.room_id = pr.room_id
    LEFT JOIN ${USER_SCHEMA}.profiles pp ON pr.participants_user_id = pp.user_id
    WHERE r.room_id = $1 AND r.deleted = FALSE
    GROUP BY r.room_id, p.user_nickname
  `;

  const result = await db.query(query, [roomId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};



module.exports = roomListModel;
