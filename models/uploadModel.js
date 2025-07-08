require('dotenv').config();

const { db } = require('../db/index');
const self = {};

/**
 *  공통 이미지 업로드 메소드
 * 
 *  @param {string} schema 스키마
 *  @param {json} params base64 encoding 이미지와 target entity, target user, table 
 *  @return {json}
 */
self.imgUploader = async (schema, params) => {
    const query = {
        text: `UPDATE ${schema}.${params.table} SET ${params.target} = $1
        WHERE ${params.column} = $2`,
        values: [params.base64Image, params.uuid]
    };

    console.log(query);

    try{
        const result = await db.query(query);
        return { success: true, rowCount: result.rowCount };
    } catch (err) {
        console.error("imgUploader error:", err);
        return { error: '이미지 업로드 실패', detail: err.message };
    }
}

module.exports = self;
