const db = require("../db");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const roomListModel = {};

/**
 * 방 리스트 조회 (커서 기반 페이지네이션 - 최신순만 지원)
 * 
 * @param {string} sort - 'latest'만 지원
 * @param {string|null} cursor - ISO8601 문자열 (room_created_at)
 * @param {number} limit - 불러올 개수
 */
roomListModel.getLatestRooms = async ({ sort, cursor, limit }) => {
  const sortField = "room_created_at";
  const orderField = sortField;

  let whereClause = `WHERE r.deleted = FALSE`;
  const values = [];

  if (cursor && sort === "latest") {
    const cursorDate = new Date(cursor);
    values.push(cursorDate);
    whereClause += ` AND r.${sortField} < $1`;
  }

  const query = `
    SELECT r.room_id, r.room_title, r.room_description, r.room_scheduled, r.room_created_at,
      r.room_thumbnail_img, r.max_participants, r.current_participants, p.user_nickname AS host_nickname
    FROM ${MAIN_SCHEMA}.room_info r
    JOIN ${USER_SCHEMA}.profiles p ON r.room_host = p.user_id
    ${whereClause}
    ORDER BY r.${orderField} DESC
    LIMIT $${values.length + 1}
  `;

  values.push(limit + 1); // limit + 1 방식으로 hasNext 판단

  const { rows } = await db.query(query, values);

  const hasNext = rows.length > limit;
  const trimmed = hasNext ? rows.slice(0, limit) : rows;

  const nextCursor = hasNext ? trimmed[trimmed.length - 1].room_created_at.toISOString() : null;

  const result = trimmed.map(room => ({
    room_id: room.room_id,
    title: room.room_title,
    description: room.room_description,
    room_scheduled: room.room_scheduled,
    created_at: room.room_created_at,
    thumbnail_path: room.room_thumbnail_img,
    current_participants: room.current_participants,
    max_participants: room.max_participants,
    host_nickname: room.host_nickname
  }));

  return {
    rooms: result,
    hasNext,
    nextCursor
  };
};

module.exports = roomListModel;
