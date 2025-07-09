const { db, pool } = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/userModel");
const uploadModel = require("./uploadModel");
require("dotenv").config();

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

const roomsModel = {};

/**
 * 현재 호스트로 활동중인지 확인하는 메소드
 * @param {string} userId - 유저 UUID
 * @returns {Promise<boolean>}
 */
roomsModel.isHost = async (userId) => {
  const query = `
    SELECT COUNT(*) 
    FROM ${MAIN_SCHEMA}.room_info 
    WHERE room_host = $1 AND deleted = false
  `;

  try {
    const result = await db.query(query, [userId]);
    console.log("호스트 중인 방 개수:", result.rows[0].count);
    return Number(result.rows[0].count) > 0;
  } catch (err) {
    console.error("isHost error:", err);
    return true; // 에러 발생 시 방 생성 제한
  }
};

/**
 * 현재 호스트 여부와 참가 중인 방 수를 모두 포함한 총 활동 방 개수 조회
 * - 호스트로 개설한 방 1개 + 참가자(게스트)로 참가한 방들 개수
 * 
 * @param {string} userId - 유저 UUID
 * @returns {Promise<number>} - 총 활동 중인 방 개수 (호스트 + 참가자)
 */
roomsModel.getActiveRoomCount = async (userId) => {
  const hostQuery = `
    SELECT COUNT(*) FROM ${MAIN_SCHEMA}.room_info
    WHERE room_host = $1 AND deleted = false
  `;
  const participantQuery = `
    SELECT COUNT(*) FROM ${MAIN_SCHEMA}.participants
    WHERE participants_user_id = $1
  `;

  try {
    const [hostRes, partRes] = await Promise.all([
      db.query(hostQuery, [userId]),
      db.query(participantQuery, [userId])
    ]);

    const hostCount = Number(hostRes.rows[0].count);
    const partCount = Number(partRes.rows[0].count);
    return hostCount + partCount;
  } catch (err) {
    console.error("getActiveRoomCount error:", err);
    return 99; // 임시 오류 대응
  }
};

/**
 * 방 생성 모듈
 * roomTitle (방 제목),
 * roomHost (방 호스트),
 * roomDescription (방 설명 (생략 가능)),
 * maxParticipants (최대 참여 가능 인원 (2 ~ 4명)),
 * currentParticipants (현재 참여 인원 (host uuid)),
 * roomEndedAt (방 종료 시간),
 * roomThumbnailImg (방 썸네일 이미지)
 * 
 * @param   {json}  params   
 * @return  {json}
 */
roomsModel.createRoom = async (params) => {
  const roomId = uuidv4();
  const participantId = uuidv4();
  const now = new Date();

  try {
    // 방장 UUID 누락 시 예외 처리
    if (!params.roomHost) {
      return { error: "방 생성에 필요한 호스트 정보가 누락되었습니다." };
    }

    // roomScheduled → Date로 파싱
    const roomScheduled = new Date(params.roomScheduled); // ex: "2025-07-10"

    // roomEndedAt → 해당 날짜 23:59:00 (KST 기준)
    const roomEndedAt = new Date(roomScheduled);
    roomEndedAt.setHours(23, 59, 0, 0);

    // 현재 호스트인지 확인
    const isHost = await roomsModel.isHost(params.roomHost);
    if (isHost) {
      return { error: "이미 활성화된 방을 호스트 중입니다." };
    }

    // 참여 방 개수 제한 확인
    const totalRoomCount = await roomsModel.getActiveRoomCount(params.roomHost);
    if (totalRoomCount >= 2) {
      return { error: "이미 두 개의 모임에 참여 중이어서 방을 생성할 수 없습니다." };
    }

    const insertQuery = `
      INSERT INTO ${MAIN_SCHEMA}.room_info (
        room_id, room_thumbnail_img, room_title, room_description,
        max_participants, room_created_at, room_ended_at,
        room_scheduled, room_host, current_participants, deleted
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, false
      )
    `;

    const insertValues = [
      roomId,
      params.roomThumbnailImg || null,
      params.roomTitle,
      params.roomDescription || null,
      params.maxParticipants,
      now,
      roomEndedAt,
      params.roomScheduled,
      params.roomHost,
      params.roomHost
    ];

    // room_info에 방 정보 insert
    await db.query(insertQuery, insertValues);
    
    // 호스트를 participants 테이블에 자동 등록
    await db.query(`
      INSERT INTO ${MAIN_SCHEMA}.participants (participants_id, room_id, participants_user_id)
      VALUES ($1, $2, $3)
    `, [participantId, roomId, params.roomHost]);

    // 이미지 다시 조회
    const { rows } = await db.query(`
      SELECT room_thumbnail_img FROM ${MAIN_SCHEMA}.room_info
      WHERE room_id = $1
    `, [roomId]);

    const thumbnailBase64 = rows[0]?.room_thumbnail_img || null;

    return {
      room_id: roomId,
      title: params.roomTitle,
      thumbnailBase64,
      message: "모임이 성공적으로 생성되었습니다.",
    };
  } catch (err) {
    console.error("createRoom error:", err);
    return { error: "모임방을 생성하는데 문제가 발생하였습니다." };
  }
};

/**
 * 방 정보 수정
 * @param {*} params 
 */
roomsModel.updateRoomInfo = async (roomId, params, requesterUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 기존 호스트 확인
    const hostResult = await client.query(
      `SELECT room_host FROM ${MAIN_SCHEMA}.room_info WHERE room_id = $1 AND deleted = false`,
      [roomId]
    );

    if (hostResult.rowCount === 0) {
      throw new Error("존재하지 않는 방입니다.");
    }

    const currentHost = hostResult.rows[0].room_host;

    // 수정 요청자가 방장인지 확인
    if (currentHost !== requesterUserId) {
      throw new Error("방 정보 수정 권한이 없습니다. (호스트 전용)");
    }

    const updateQuery = `
      UPDATE ${MAIN_SCHEMA}.room_info
      SET room_title = $1, room_description = $2, room_scheduled = $3,
        room_host = COALESCE($4, room_host), room_thumbnail_img = COALESCE($5, room_thumbnail_img)
      WHERE room_id = $6 AND deleted = false
    `;

    const updateValues = [
      params.roomTitle,
      params.roomDescription || null,
      params.roomScheduled,
      params.roomHost || null,
      params.roomThumbnailImg || null,
      roomId
    ];

    await client.query(updateQuery, updateValues);

    await client.query('COMMIT');
    return { message: "방 정보가 수정되었습니다." };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("updateRoomInfo error:", err);
    return { message: "방 정보 수정에 실패하였습니다." };
  } finally {
    client.release();
  }
};

/**
 * 방 비활성화 (soft delete) + 참가자 제거
 * 
 * @param {string} roomId - 방 UUID
 * @returns {Promise<object>}
 */
roomsModel.deactivateRoom = async (roomId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE ${MAIN_SCHEMA}.room_info
      SET deleted = true
      WHERE room_id = $1`,
      [roomId]
    );

    await client.query(
      `DELETE FROM ${MAIN_SCHEMA}.participants
      WHERE room_id = $1`,
      [roomId]
    );

    await client.query("COMMIT");
    return { message: "모임이 비활성화되었습니다." };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deactivateRoom error:", err);
    return { message: "모임 비활성화 실패" };
  } finally {
    client.release();
  }
};

/**
 * 방 참가자 목록 조회
 * 
 * @param {string} roomId - 방 UUID
 * @returns {Promise<array>}
 */
roomsModel.getRoomParticipants = async (roomId) => {
  const query = `
    SELECT p.user_id, p.user_nickname, p.user_profile_img, (r.room_host = p.user_id) AS is_host
    FROM ${MAIN_SCHEMA}.participants pa
    INNER JOIN ${USER_SCHEMA}.profiles p ON pa.participants_user_id = p.user_id
    INNER JOIN ${MAIN_SCHEMA}.room_info r ON pa.room_id = r.room_id
    WHERE pa.room_id = $1
  `;

  try {
    const result = await db.query(query, [roomId]);
    return result.rows;
  } catch (err) {
    console.error("getRoomParticipants error:", err);
    return [];
  }
};

/**
 * 방 참가
 * @param {string} roomId - 참가할 방 UUID
 * @param {string} userId - 참가자 UUID
 * @returns {Promise<object>}
 */
roomsModel.joinRoom = async (roomId, userId) => {
  try {
    // 블랙리스트 확인
    const blacklistQuery = `
      SELECT 1 FROM ${MAIN_SCHEMA}.blacklist
      WHERE room_id = $1 AND blacklist_user_id = $2
    `;
    const blacklisted = await db.query(blacklistQuery, [roomId, userId]);
    if (blacklisted.rowCount > 0) {
      return {
        error: "해당 방에 참여할 수 없습니다. (블랙리스트 처리됨)",
        error_code: "BLACKLISTED"
      };
    }

    // 2. 진행 중인 방 개수 확인 (host 또는 participant로)
    const activeRooms = await userModel.getMyActiveRooms(userId);
    if (activeRooms.length >= 2) {
      return { error: "이미 두 개의 진행 중인 모임에 참여 중입니다." };
    }

    // 중복 참가 확인
    const existQuery = `
      SELECT 1 FROM ${MAIN_SCHEMA}.participants 
      WHERE room_id = $1 AND participants_user_id = $2
    `;
    const exist = await db.query(existQuery, [roomId, userId]);
    if (exist.rowCount > 0) {
      return { error: "이미 해당 모임에 참여 중입니다." };
    }

    // 참가 가능 인원 확인 (최대 4명으로 고정)
    const currentCountQuery = `
      SELECT COUNT(*) FROM ${MAIN_SCHEMA}.participants
      WHERE room_id = $1
    `;
    const currentCountRes = await db.query(currentCountQuery, [roomId]);
    const currentParticipants = parseInt(currentCountRes.rows[0].count, 10);
    if (currentParticipants >= 4) {
      return { error: "이 방은 이미 정원이 가득 찼습니다." };
    }

    // 참가 처리
    const insertQuery = `
      INSERT INTO ${MAIN_SCHEMA}.participants (
        participants_id, room_id, participants_user_id
      ) VALUES ($1, $2, $3)
    `;
    await db.query(insertQuery, [uuidv4(), roomId, userId]);

    return {
      message: "모임에 참가했습니다.",
      room_id: roomId
    };
  } catch (err) {
    console.error("joinRoom error:", err);
    return { message: "참가 중 문제가 발생했습니다." };
  }
};

/**
 * 방 나가기
 * 방장은 활성 상태일 경우 비활성화로 나가야 하며,
 * 종료된 방(room_ended_at 경과)일 경우 일반 유저처럼 나갈 수 있음
 * 
 * @param {string} roomId - 방 UUID
 * @param {string} userId - 유저 UUID
 * @returns {Promise<object>}
 */
roomsModel.leaveRoom = async (roomId, userId) => {
  try {
    // 호스트 여부 확인 + 종료 상태 확인
    const hostCheckQuery = `
      SELECT room_host, room_ended_at FROM ${MAIN_SCHEMA}.room_info
      WHERE room_id = $1 AND deleted = false
    `;
    const hostResult = await db.query(hostCheckQuery, [roomId]);

    if (hostResult.rowCount === 0) {
      return { error: "모임방이 존재하지 않습니다." };
    }

    const { room_host, room_ended_at } = hostResult.rows[0];
    const isHost = room_host === userId;

    if (isHost) {
      const now = new Date();
      const endedAt = new Date(room_ended_at);
      // room_ended_at이 없거나 아직 도달하지 않았으면 방장은 나갈 수 없음
      if (!room_ended_at || now < endedAt) {
        return {
          error: "방장은 활성화 중인 방에서는 나갈 수 없습니다. 먼저 방을 비활성화해야 합니다."
        };
      }
      // room_ended_at이 이미 지났으면 그냥 나갈 수 있음
    }

    // 참여 여부 확인
    const existQuery = `
      SELECT 1 FROM ${MAIN_SCHEMA}.participants 
      WHERE room_id = $1 AND participants_user_id = $2
    `;
    const exist = await db.query(existQuery, [roomId, userId]);
    if (exist.rowCount === 0) {
      return { error: "해당 모임에 참여 중이 아니어서 나갈 수 없습니다." };
    }

    // 참여자 삭제 처리
    const deleteQuery = `
      DELETE FROM ${MAIN_SCHEMA}.participants
      WHERE room_id = $1 AND participants_user_id = $2
    `;
    await db.query(deleteQuery, [roomId, userId]);

    return {
      message: "모임에서 정상적으로 나갔습니다.",
      room_id: roomId
    };
  } catch (err) {
    console.error("leaveRoom error:", err);
    return {
      message: "모임 나가기 중 문제가 발생했습니다.",
      error: err.message
    };
  }
};

/**
 * 특정 방의 호스트 UUID 조회
 * 
 * @param {string} roomId - 방 UUID
 * @returns {Promise<string|null>} - 호스트의 UUID 또는 null (방이 존재하지 않거나 에러 발생 시)
 */
roomsModel.getRoomHost = async (roomId) => {
  const query = `
    SELECT room_host FROM ${MAIN_SCHEMA}.room_info
    WHERE room_id = $1 AND deleted = false
  `;
  try {
    const result = await db.query(query, [roomId]);
    if (result.rowCount === 0) return null;
    return result.rows[0].room_host;
  } catch (err) {
    console.error("방장의 UUID를 조회할 수 없음:", err);
    return null;
  }
};

/**
 * 방 강제 퇴장 및 블랙리스트 등록
 * @param {string} roomId 
 * @param {string} targetUserId 
 * @returns {Promise<object>}
 */
roomsModel.kickUserFromRoom = async (roomId, targetUserId) => {
  try {
    // participants 테이블에서 제거
    const deleteQuery = `
      DELETE FROM ${MAIN_SCHEMA}.participants
      WHERE room_id = $1 AND participants_user_id = $2
    `;
    await db.query(deleteQuery, [roomId, targetUserId]);

    // blacklist 등록
    const insertBlacklistQuery = `
      INSERT INTO ${MAIN_SCHEMA}.blacklist (
        blacklist_id, room_id, blacklist_user_id
      ) VALUES ($1, $2, $3)
    `;
    await db.query(insertBlacklistQuery, [uuidv4(), roomId, targetUserId]);

    return {
      message: "해당 유저를 강퇴했습니다.",
      blacklisted: true
    };
  } catch (err) {
    console.error("kickUserFromRoom error:", err);
    return { message: "유저 강퇴 실패" };
  }
};

module.exports = roomsModel;
