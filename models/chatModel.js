const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const chatModel = {};

/**
 * 채팅 메시지를 DB에 저장합니다.
 * @param {string} roomId - 채팅이 속한 방 ID
 * @param {string} userId - 메시지를 보낸 사용자 ID
 * @param {string} chatMsg - 전송할 채팅 메시지
 * @returns {Promise<object>} 저장된 채팅 메시지 객체
 */
chatModel.insertChat = async (roomId, userId, chatMsg) => {

};

/**
 * 방장이 특정 유저의 출석을 수동으로 체크합니다.
 * @param {string} roomId - 방 ID
 * @param {string} userId - 출석할 사용자 ID
 * @returns {Promise<object|null>} 출석 완료된 참가자 레코드, 실패 시 null
 */
chatModel.markAttendance = async (roomId, userId) => {

};

/**
 * 사용자가 이미 출석하지 않은 경우 자동으로 출석을 처리합니다.
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<object|null>} 출석 완료된 레코드, 이미 출석 시 null
 */
chatModel.autoAttendance = async (roomId, userId) => {

};

/**
 * 해당 방의 채팅을 종료하며, 종료 시각을 23:59로 설정합니다.
 * @param {string} roomId - 종료할 방의 ID
 * @returns {Promise<object>} 업데이트된 room_ended_at 시간
 */
chatModel.endChatRoom = async (roomId) => {

};

/**
 * 모임 종료 후 유저의 평판을 업데이트합니다.
 * @param {string} userId - 평가 받을 유저의 ID
 * @param {"warm"|"cold"} reputation - 평판 종류 ("warm" 또는 "cold")
 * @returns {Promise<object>} 업데이트된 like_temp
 */
chatModel.updateReputation = async (userId, reputation) => {

};

module.exports = chatModel;
