const db = require("../db");

const MAIN_SCHEMA = process.env.DB_MAIN_SCHEMA;

const emblemModel = {};

/**
 * 엠블럼 이름으로 중복 확인
 * @param {string} emblemName 
 * @returns {Promise<boolean>}
 */
emblemModel.exists = async (emblemName) => {
  const query = `
    SELECT 1 FROM ${MAIN_SCHEMA}.emblems
    WHERE emblem_name = $1
    LIMIT 1
  `;
  const result = await db.query(query, [emblemName]);
  return result.rows.length > 0;
};

/**
 * 엠블럼 등록
 * @param {string} emblemId 
 * @param {string} emblemName 
 * @param {string} emblemDescription 
 */
emblemModel.createEmblem = async (emblemId, emblemName, emblemDescription) => {
  const query = `
    INSERT INTO ${MAIN_SCHEMA}.emblems (emblem_id, emblem_name, emblem_description)
    VALUES ($1, $2, $3)
  `;
  await db.query(query, [emblemId, emblemName, emblemDescription]);
};

/**
 * 전체 엠블럼 조회
 * @returns {Promise<Array>}
 */
emblemModel.getAll = async () => {
  const query = `
    SELECT emblem_id, emblem_name, emblem_description
    FROM ${MAIN_SCHEMA}.emblems
    ORDER BY emblem_name ASC
  `;
  const result = await db.query(query);
  return result.rows;
};


/**
 * 엠블럼 삭제
 * @param {string} emblemName 
 */
emblemModel.deleteByName = async (emblemName) => {
  const query = `
    DELETE FROM ${MAIN_SCHEMA}.emblems
    WHERE emblem_name = $1
  `;
  await db.query(query, [emblemName]);
};

module.exports = emblemModel;
