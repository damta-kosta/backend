require('dotenv').config();

const db = require('../db/index');
const self = {};

/**
 *  공통 이미지 업로드 메소드
 * 
 *  @param {string} schema 스키마
 *  @param {string} table 테이블
 *  @param {json} params base64 encoding 이미지와 target user
 *  @return {json}
 */
 
self.imgUploader = async (schema, table, params) => {
    try{
        const query = `UPDATE ${table} SET room_thumbnail_img = ${params.base64Image}) WHERE room_id = ${params.room_id}`;
        const ret = await db.query();
        

    } catch (err) {
        res.status(500).send("err");
    }
}


module.exports = self;