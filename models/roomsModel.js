const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");
require("dotenv").config();

const USER_SCHEMA = process.env.DB_USER_SCHEMA;
const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;

const self = {};

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
self.createRoom = async (params) => {
    const query = `INSERT INTO ${MAIN_SCHEMA}.room_info (
    room_id, room_thumbnail_img, room_title, room_description, max_participants, 
    room_created_at, room_ended_at, room_host, current_participants ) 
    VALUES (${uuidv4()}, ${params.roomThumbnailImg}, ${params.roomTitle}, 
    ${params.roomDescription}, ${params.maxParticipants}, ${getDate(0)},
    ${params.roomEndedAt}, ${params.roomHost}, ${params.roomHost})`;
    
    try {
        const ret = await db.query(query);
        return ret;
    } catch(err) {
        return err;
    }

}

module.exports = self;