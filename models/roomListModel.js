const db = require("../db");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const roomListModel = {};

/**
 * 방 리스트 조회 (커서 기반 페이지네이션 + 인기순 or 최신순 정렬)
 * 
 * @param {string} sort - 'latest' | 'popular'
 * @param {string | null} cursor - 커서 기준 시각 (room_created_at 또는 room_scheduled)
 * @param {number} limit - 불러올 개수
 */
roomListModel.getRoomList = async ({ sort, cursor, limit }) => {
  const sortField = sort === "popular" ? "room_scheduled" : "room_created_at";
  const orderField = sort === "popular" ? "current_participants" : "room_created_at";

  const whereClause = cursor
    ? `WHERE r.deleted = FALSE AND r.${sortField} < $1`
    : `WHERE r.deleted = FALSE`;

  const query = `
    SELECT r.room_id, r.room_title, r.room_description, r.room_scheduled, r.room_thumbnail_img,
      r.max_participants, r.current_participants, p.user_nickname AS host_nickname, r.${sortField} AS cursor_field
    FROM ${MAIN_SCHEMA}.room_info r
    JOIN ${USER_SCHEMA}.profiles p ON r.room_host = p.user_id ${whereClause}
    ORDER BY r.${orderField} DESC
    LIMIT $${cursor ? 2 : 1}
  `;

  const values = cursor ? [cursor, limit + 1] : [limit + 1];
  const { rows } = await db.query(query, values);

  const hasNext = rows.length > limit;
  const trimmed = hasNext ? rows.slice(0, limit) : rows;
  const nextCursor = hasNext ? trimmed[trimmed.length - 1].cursor_field : null;

  const result = trimmed.map(room => ({
    room_id: room.room_id,
    title: room.room_title,
    description: room.room_description,
    room_scheduled: room.room_scheduled,
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
