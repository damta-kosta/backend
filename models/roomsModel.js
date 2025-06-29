const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");
require("dotenv").config();

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;
const USER_SCHEMA = process.env.DB_USER_SCHEMA;

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
  const now = getDate(0);

  try {
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

    const query = `
      INSERT INTO ${MAIN_SCHEMA}.room_info (
        room_id, room_thumbnail_img, room_title, room_description,
        max_participants, room_created_at, room_ended_at,
        room_host, current_participants, deleted
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, false
      )
    `;

    const values = [
      roomId,
      params.roomThumbnailImg,
      params.roomTitle,
      params.roomDescription || null,
      params.maxParticipants,
      now,
      params.roomEndedAt,
      params.roomHost,
      params.roomHost
    ];

    await db.query(query, values);
    return {
      room_id: roomId,
      title: params.roomTitle,
      thumbnailBase64: params.roomThumbnailImg,
      message: "모임이 성공적으로 생성되었습니다.",
    };
  } catch (err) {
    console.error("createRoom error:", err);
    return { message: "모임방을 생성하는데 문제가 발생하였습니다." };
  }
};

/**
 * 방 정보 수정
 * @param {*} params 
 */
roomsModel.updateRoomInfo = async (roomId, params) => {
  const query = `
    UPDATE ${MAIN_SCHEMA}.room_info
    SET room_title = $1, room_description = $2, room_thumbnail_img = $3, room_updated_at = $4
    WHERE room_id = $5 AND deleted = false
  `;

  const values = [
    params.roomTitle,
    params.roomDescription || null,
    params.roomThumbnailImg,
    getDate(0),
    roomId
  ];

  try {
    await db.query(query, values);
    return { message: "방 정보가 수정되었습니다." };
  } catch (err) {
    console.error("updateRoomInfo error:", err);
    return { message: "방 정보 수정에 실패하였습니다." };
  }
};

/**
 * 방 비활성화 (soft delete)
 * 
 * @param {string} roomId - 방 UUID
 * @returns {Promise<object>}
 */
roomsModel.deactivateRoom = async (roomId) => {
  const query = `
    UPDATE ${MAIN_SCHEMA}.room_info
    SET deleted = true, room_updated_at = $1
    WHERE room_id = $2
  `;
  const values = [getDate(0), roomId];

  try {
    await db.query(query, values);
    return { message: "모임이 비활성화되었습니다." };
  } catch (err) {
    console.error("deactivateRoom error:", err);
    return { message: "모임 비활성화 실패" };
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
    FROM ${USER_SCHEMA}.profiles p
    INNER JOIN ${MAIN_SCHEMA}.room_info r ON r.room_id = $1
    WHERE p.user_id = ANY(r.current_participants)
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
  const now = getDate(0);

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

    // 이미 참가 중인 방 개수 확인
    const joinedCountQuery = `
      SELECT COUNT(*) FROM ${MAIN_SCHEMA}.participants 
      WHERE participants_user_id = $1
    `;
    const countRes = await db.query(joinedCountQuery, [userId]);
    if (parseInt(countRes.rows[0].count, 10) >= 2) {
      return { error: "이미 두 개의 모임에 참여 중입니다." };
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
      return { error: "이 방은 이미 정원(4명)이 가득 찼습니다." };
    }

    // 참가 처리
    const insertQuery = `
      INSERT INTO ${MAIN_SCHEMA}.participants (
        participants_id, room_id, participants_user_id, attended_at
      ) VALUES ($1, $2, $3, $4)
    `;
    await db.query(insertQuery, [uuidv4(), roomId, userId, now]);

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
 * 방장은 직접 나갈 수 없고 방을 비활성화해야 함
 * 
 * @param {string} roomId - 방 UUID
 * @param {string} userId - 유저 UUID
 * @returns {Promise<object>}
 */
roomsModel.leaveRoom = async (roomId, userId) => {
  try {
    // 호스트 여부 확인
    const hostCheckQuery = `
      SELECT room_host FROM ${MAIN_SCHEMA}.room_info
      WHERE room_id = $1 AND deleted = false
    `;
    const hostResult = await db.query(hostCheckQuery, [roomId]);
    if (hostResult.rowCount === 0) {
      return { error: "모임방이 존재하지 않습니다." };
    }
    if (hostResult.rows[0].room_host === userId) {
      return {
        error: "방장은 비활성화(PATCH /rooms/:id/deactivate)로 나가야 합니다."
      };
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
