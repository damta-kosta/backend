require('dotenv').config();

const db = require('../db/index');
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
        text: `UPDATE ${schema}.${params.table} SET ${params.target} = ${params.base64Image} 
        WHERE ${params.column} = $1`,
        values: [params.uuid]
    };

    console.log(query);

    try{
        const ret = await db.query(query);

        return ret;
    } catch (err) {
        console.log(err)
        return err;
    }
}


module.exports = self;