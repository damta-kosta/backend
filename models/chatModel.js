const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const chatModel = {};
const reputationCache = new Set();

/**
 * 방 정보 조회
 * @param {string} roomId 
 * @returns {Promise<object|null>}
 */
chatModel.getRoomInfo = async (roomId) => {
  const query = `
    SELECT room_host, room_scheduled, room_ended_at, attendance_checked_at, room_title AS title
    FROM ${MAIN_SCHEMA}.room_info
    WHERE room_id = $1;
  `;
  const { rows } = await db.query(query, [roomId]);
  return rows[0] || null;
};

/**
 * 주어진 roomId에 해당하는 최신 채팅 메시지를 조회합니다.
 * 이 함수는 커서가 없는 경우 최신 메시지를 불러올 때 사용됩니다.
 * 
 * 반환 결과는 created_at 기준으로 **내림차순(DESC)** 정렬되어 있으며,
 * 최신 메시지가 먼저 옵니다. (UI 표시 시에는 reverse() 필요할 수 있음)
 *
 * @async
 * @function getRecentChats
 * @memberof chatModel
 * 
 * @param {string} roomId - 채팅 메시지를 조회할 방의 UUID
 * @param {number} [limit=30] - 조회할 메시지 개수 (기본값: 30)
 * 
 * @returns {Promise<Array<{
 *   chat_id: string,
 *   room_id: string,
 *   user_id: string,
 *   chat_msg: string,
 *   created_at: string,
 *   user_nickname: string,
 *   user_profile_img: string
 * }>>} - 채팅 메시지 객체 배열
 */
chatModel.getRecentChats = async (roomId, limit = 30) => {
  const query = `
    SELECT c.chat_id, c.room_id, c.user_id, c.chat_msg, c.created_at, u.user_nickname, u.user_profile_img
    FROM ${MAIN_SCHEMA}.chat c
    JOIN ${USER_SCHEMA}.profiles u ON c.user_id = u.user_id
    WHERE c.room_id = $1
    ORDER BY c.created_at DESC
    LIMIT $2;
  `;
  const { rows } = await db.query(query, [roomId, limit]);
  return rows;
};

/**
 * 커서 기반으로 특정 방의 이전 채팅 메시지를 조회합니다.
 * 무한 스크롤(페이지네이션) 방식 구현에 사용됩니다.
 *
 * @param {string} roomId - 채팅 메시지를 조회할 방의 ID
 * @param {string} cursor - 기준이 되는 이전 메시지의 created_at 타임스탬프 (ISO 문자열)
 * @param {number} [limit=30] - 조회할 메시지 개수 (기본값: 30)
 * @returns {Promise<Array<object>>} 이전 메시지 객체 배열
 */
chatModel.getChatsBeforeCursor = async (roomId, cursor, limit = 30) => {
  const query = `
    SELECT c.chat_id, c.room_id, c.user_id, c.chat_msg, c.created_at, u.user_nickname, u.user_profile_img
    FROM ${MAIN_SCHEMA}.chat c
    JOIN ${USER_SCHEMA}.profiles u ON c.user_id = u.user_id
    WHERE c.room_id = $1 AND c.created_at < $2
    ORDER BY c.created_at DESC
    LIMIT $3;
  `;
  const { rows } = await db.query(query, [roomId, cursor, limit]);
  return rows;
};

/**
 * 방의 모든 인원이 출석 완료했는지 확인
 * @param {string} roomId 
 * @returns {Promise<boolean>}
 */
chatModel.hasAllAttended = async (roomId) => {
  const query = `
    SELECT COUNT(*) AS not_attended
    FROM ${MAIN_SCHEMA}.participants
    WHERE room_id = $1 AND attended_at IS DISTINCT FROM true;
  `;
  const { rows } = await db.query(query, [roomId]);
  return parseInt(rows[0].not_attended) === 0;
};

/**
 * 출석 체크 완료 시간 기록
 */
chatModel.setAttendanceCheckedAt = async (roomId) => {
  const now = new Date();

  const query = `
    UPDATE ${MAIN_SCHEMA}.room_info
    SET attendance_checked_at = $2
    WHERE room_id = $1;
  `;

  await db.query(query, [roomId, now]);
};

/**
 * 특정 유저가 출석했는지 확인
 * @param {string} roomId 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
chatModel.isUserAttended = async (roomId, userId) => {
  const query = `
    SELECT attended_at
    FROM ${MAIN_SCHEMA}.participants
    WHERE room_id = $1 AND participants_user_id = $2;
  `;
  const { rows } = await db.query(query, [roomId, userId]);
  return rows[0]?.attended_at === true;
};

/**
 * 현재 시간이 room_ended_at 이전인지 확인
 * @param {string} roomId 
 * @returns {Promise<boolean>}
 */
chatModel.isReputationAllowed = async (roomId) => {
  const query = `
    SELECT room_ended_at
    FROM ${MAIN_SCHEMA}.room_info
    WHERE room_id = $1;
  `;
  const { rows } = await db.query(query, [roomId]);
  if (!rows.length || !rows[0].room_ended_at) return false;
  return new Date() <= new Date(rows[0].room_ended_at);
};

/**
 * 채팅 메시지 저장
 * @param {string} roomId 
 * @param {string} userId 
 * @param {string} chatMsg 
 * @returns {Promise<object>}
 */
chatModel.insertChat = async (roomId, userId, message) => {
  const chatId = uuidv4();
  const createdAt = new Date();

  const query = `
    WITH inserted AS (
      INSERT INTO ${MAIN_SCHEMA}.chat (chat_id, room_id, user_id, chat_msg, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING chat_id, room_id, user_id, chat_msg, created_at
    )
    SELECT 
      i.chat_id, i.room_id, i.user_id, i.chat_msg, i.created_at,
      p.user_nickname, p.user_profile_img
    FROM inserted i
    JOIN ${USER_SCHEMA}.profiles p ON i.user_id = p.user_id;
  `;

  const values = [chatId, roomId, userId, message, createdAt];
  const { rows } = await db.query(query, values);
  return rows[0];
};

/**
 * 방장 수동 출석 체크 - 다중 유저
 * @param {string} roomId 
 * @param {Array<string>} targetUserIds 
 * @param {string} requestUserId 
 * @returns {Promise<{ updated: number } | { error: string, status: number }>}
 */
chatModel.markAttendanceBulk = async (roomId, targetUserIds, requestUserId) => {
  const room = await chatModel.getRoomInfo(roomId);
  if (!room) return { error: "해당 방이 존재하지 않습니다.", status: 404 };

  if (room.room_host !== requestUserId) {
    return { error: "방장이 아닙니다.", status: 403 };
  }

  const now = new Date();
  if (new Date(now) >= new Date(room.room_scheduled)) {
    return { error: "모임 시간이 이미 지났습니다. 출석 체크 불가.", status: 403 };
  }

  const query = `
    UPDATE ${MAIN_SCHEMA}.participants
    SET attended_at = true
    WHERE room_id = $1 AND participants_user_id = ANY($2::uuid[])
    RETURNING participants_user_id;
  `;

  const { rows } = await db.query(query, [roomId, targetUserIds]);

  // 전체 참석자 출석 여부 확인
  const allChecked = await chatModel.hasAllAttended(roomId);
  if (!allChecked) {
    return { error: "수동 출석은 전부 체크해야합니다.", status: 400 };
  }

  // 출석 완료 시각 기록
  await chatModel.setAttendanceCheckedAt(roomId);

  return { updated: rows.length };
};

/**
 * 자동 출석 체크 - attendedUsers는 true로, 나머지는 false + cold 평판 적용
 * @param {string} roomId 
 * @param {Array<string>} attendedUserIds 
 * @returns {Promise<{updatedTrue: number, updatedFalse: number, autoColds: number}>}
 */
chatModel.autoAttendance = async (roomId, attendedUserIds, requestUserId) => {
  const room = await chatModel.getRoomInfo(roomId);
  if(!room) return { error: "해당 방이 존재하지 않습니다.", status: 404 };

  if (room.room_host !== requestUserId) {
    return { error: "방장이 아닙니다.", status: 403 };
  }

  if (room.attendance_checked_at) {
    return { error: "이미 출석 체크가 완료된 방입니다.", status: 400 };
  }

  const now = new Date();
  if (new Date(now) >= new Date(room.room_scheduled)) {
    return { error: "모임 시간이 이미 지났습니다. 출석 체크 불가.", status: 403 };
  }

  // true 처리
  const updateTrueQuery = `
    UPDATE ${MAIN_SCHEMA}.participants
    SET attended_at = true
    WHERE room_id = $1 AND participants_user_id = ANY($2::uuid[])
    RETURNING participants_user_id;
  `;
  const { rows: trueRows } = await db.query(updateTrueQuery, [roomId, attendedUserIds]);

  // false 처리 대상
  const { rows: falseTargets } = await db.query(`
    SELECT participants_user_id
    FROM ${MAIN_SCHEMA}.participants
    WHERE room_id = $1 AND participants_user_id != ALL($2::uuid[]) AND attended_at IS DISTINCT FROM true;
  `, [roomId, attendedUserIds]);
  const falseUserIds = falseTargets.map(row => row.participants_user_id);

  // false 처리
  await db.query(`
    UPDATE ${MAIN_SCHEMA}.participants
    SET attended_at = false
    WHERE room_id = $1 AND participants_user_id = ANY($2::uuid[]);
  `, [roomId, falseUserIds]);

  // 출석자 → 미출석자 cold 반복
  for (const from of attendedUserIds) {
    for (const to of falseUserIds) {
      await chatModel.updateReputation(to, "cold", from, roomId);
    }
  }

  await chatModel.setAttendanceCheckedAt(roomId);

  return {
    updatedTrue: trueRows.length,
    updatedFalse: falseUserIds.length,
    autoColds: attendedUserIds.length * falseUserIds.length
  };
};

/**
 * 방 조기 종료 처리
 * @param {string} roomId 
 * @returns {Promise<object>}
 */
chatModel.endChatRoom = async (roomId) => {
  const now = new Date();
  const query = `
    UPDATE ${MAIN_SCHEMA}.room_info
    SET room_ended_at = $2
    WHERE room_id = $1
    RETURNING room_ended_at;
  `;
  const { rows } = await db.query(query, [roomId, now]);
  return rows[0];
};

/**
 * 평판 적용 (warm 또는 cold)
 * @param {string} userId 
 * @param {"warm"|"cold"} reputation 
 * @returns {Promise<object>}
 */
chatModel.updateReputation = async (userId, reputation) => {
  const delta = reputation === "warm" ? 0.3 : -0.3;
  const query = `
    UPDATE ${USER_SCHEMA}.profiles
    SET like_temp = ROUND(GREATEST(0, LEAST(100, like_temp + $1)), 1)
    WHERE user_id = $2
    RETURNING like_temp;
  `;
  const { rows } = await db.query(query, [delta, userId]);
  return rows[0];
};

/**
 * 특정 방에 참여한 참가자들의 목록을 조회합니다.
 * @param {string} roomId - 방 ID
 * @returns {Promise<Array<object>>} 참가자 정보 배열
 */
chatModel.getParticipantsByRoom = async (roomId, hostUserId) => {
  const query = `
    SELECT p.participants_user_id AS user_id, u.user_nickname, u.user_profile_img, p.attended_at,
      CASE WHEN p.participants_user_id = $2 THEN true ELSE false END AS is_host
    FROM ${MAIN_SCHEMA}.participants p
    JOIN ${USER_SCHEMA}.profiles u ON p.participants_user_id = u.user_id
    WHERE p.room_id = $1
    ORDER BY u.user_nickname;
  `;
  const { rows } = await db.query(query, [roomId, hostUserId]);
  return rows;
};

/**
 * 사용자가 특정 방의 참가자인지 확인
 * @param {string} roomId 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
chatModel.isUserParticipant = async (roomId, userId) => {
  const query = `
    SELECT 1 FROM ${MAIN_SCHEMA}.participants
    WHERE room_id = $1 AND participants_user_id = $2
    LIMIT 1;
  `;
  
  const { rows } = await db.query(query, [roomId, userId]);
  return rows.length > 0;
};

/**
 * 특정 방의 전체 채팅 메시지를 조회합니다.
 * @param {string} roomId 
 * @returns {Promise<Array<object>>}
 */
chatModel.getAllChatByRoom = async (roomId) => {
  const query = `
    SELECT c.chat_id, c.room_id, c.user_id, c.chat_msg, c.created_at, u.user_nickname, u.user_profile_img
    FROM ${MAIN_SCHEMA}.chat c
    JOIN ${USER_SCHEMA}.profiles u ON c.user_id = u.user_id
    WHERE c.room_id = $1
    ORDER BY c.created_at ASC;
  `;

  const { rows } = await db.query(query, [roomId]);
  return rows;
};

/**
 * 이미 평판을 남긴 적 있는지 확인
 * @param {string} roomId 
 * @param {string} fromUserId 
 * @param {string} toUserId 
 * @returns {boolean}
 */
chatModel.checkAlreadyRated = (roomId, fromUserId, toUserId) => {
  const key = `${roomId}:${fromUserId}->${toUserId}`;
  return reputationCache.has(key);
};

/**
 * 평판을 남긴 기록을 캐시에 저장
 * @param {string} roomId 
 * @param {string} fromUserId 
 * @param {string} toUserId 
 */
chatModel.recordReputation = (roomId, fromUserId, toUserId) => {
  const key = `${roomId}:${fromUserId}->${toUserId}`;
  reputationCache.add(key);
};

/**
 * 사용자가 특정 방에서 블랙리스트에 등록되어 있는지 확인
 * @param {string} roomId 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
chatModel.isBlacklisted = async (roomId, userId) => {
  const query = `
    SELECT 1
    FROM ${MAIN_SCHEMA}.blacklist
    WHERE room_id = $1 AND blacklist_user_id = $2
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [roomId, userId]);
  return rows.length > 0;
};

chatModel.getRoomTitleById = async (roomId) => {
  const query = `
    SELECT room_title FROM main_schema.room_info
    WHERE room_id = $1
  `;
  const result = await db.query(query, [roomId]);
  return result.rows[0]?.room_title || "알 수 없음";
}

chatModel.getNicknameByUserId = async (userId) => {
  const query = `
    SELECT user_nickname FROM user_schema.profiles
    WHERE user_id = $1
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0]?.user_nickname || "이름 없음";
  
}

/**
 * 현재 사용자가 호스트이거나 참가 중인 모든 방을 조회한다.
 *
 * [조건]
 * - 소프트 삭제되지 않은 방만 조회 (r.deleted = false)
 * - 종료된 방도 포함됨 (room_ended_at 조건 없음)
 * - 유저가 방장이거나 participants 테이블에 있는 경우만 해당
 *
 * @param {string} userId - 현재 로그인한 사용자의 UUID
 * @returns {Promise<Array>} - 사용자가 참여 중인 모든 방 목록
 *
 * 각 방 객체는 다음 정보를 포함한다:
 * - room_id {string}: 방 UUID
 * - room_title {string}: 방 제목
 * - room_scheduled {Date}: 예정된 날짜
 * - room_thumbnail_img {string}: 썸네일(base64 또는 경로)
 * - deleted {boolean}: 소프트 삭제 여부
 * - is_host {boolean}: 해당 방의 호스트 여부 (true/false)
 */
chatModel.getMyActiveRooms = async (userId) => {
  const query = `
    SELECT r.room_id, r.room_title, r.room_scheduled, r.room_thumbnail_img, r.deleted, (r.room_host = $1) AS is_host
    FROM ${MAIN_SCHEMA}.room_info r
    LEFT JOIN ${MAIN_SCHEMA}.participants p ON r.room_id = p.room_id
    WHERE (r.room_host = $1 OR p.participants_user_id = $1) AND r.deleted = false
    GROUP BY r.room_id
    ORDER BY r.room_scheduled DESC
  `;

  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("참가 중인 방 오류:", err);
    return [];
  }
};

module.exports = chatModel;
