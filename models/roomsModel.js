const db = require("../db/index");
const { v4: uuidv4 } = require("uuid");
const { getDate } = require("../modules/getData");
require("dotenv").config();

const USER_SCHEMA = process.env.DB_USER_SCHEMA;
const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;

const self = {};

/**
 * 방 생성 모듈
 * @param   {string}            roomTitle           방 제목
 * @param   {uuid}              roomHost            방 호스트
 * @param   {string}            roomDescription     방 설명 (생략 가능)
 * @param   {number}            maxParticipants     최대 참여 가능 인원 (2 ~ 4명)
 * @param   {uuid}              currentParticipants 현재 참여 인원 (host uuid)
 * @param   {date}              roomEndedAt         방 종료 시간
 * @param   {Base64URLString}   roomThumbnailImg    방 썸네일 이미지
 * @return  {json}
 */
self.createRoom = () => {
    
}



module.exports = self;