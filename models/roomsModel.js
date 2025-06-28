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
  // console.log("params: ", params.roomHost);
  const roomID = uuidv4();
  const now = getDate(0);

  const ret = {};
  ret.title = params.roomTitle
  ret.thumbnailBase64 = params.roomThumbnailImg
    
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
    roomID, // 1
    params.roomThumbnailImg, //2
    params.roomTitle, //3
    params.roomDescription,//4 
    params.maxParticipants, //5
    now,//6 
    params.roomEndedAt, //7
    params.roomHost, //8
    params.roomHost//9
  ]
    
  try {
    await db.query(query, values);
    return {
      room_id: roomId,
      title: params.roomTitle,
      thumbnailBase64: params.roomThumbnailImg,
      message: "모임이 성공적으로 생성되었습니다.",
    };
  } catch(err) {
    console.error("createRoom error:", err);
    return {
      message: "모임방을 생성하는데 문제가 발생하였습니다.",
    };
  }
};

/**
 * 방 정보 수정
 * @param {*} params 
 */
roomsModel.updateRoomInfo = async (params) => {
}

module.exports = roomsModel;
