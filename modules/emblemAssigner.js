const { db } = require("../db");
const emblemAssigner = {};

// like_temp 범위별 엠블럼 매핑
const emblemMap = [
  { min: 0, max: 20, id: "661db6cb-1279-4745-af55-8d23ce24cb02" }, // 노쇼 장인
  { min: 21, max: 40, id: "873a8d57-9d44-4410-b85b-bb7adfbdf0bb" }, // 서늘한 사람
  { min: 41, max: 60, id: "60b1f695-5426-40b3-870c-3be037ccebe7" }, // 평범한 친구
  { min: 61, max: 80, id: "80ea607c-943e-4824-8718-e86eee3bc540" }, // 따뜻한 동료
  { min: 81, max: 100, id: "172c54f1-4807-4c1a-a1a2-ea36046d45fc" } // 불꽃 인싸
];

emblemAssigner.getEmblemIdByLikeTemp = (temp) => {
  const match = emblemMap.find(({ min, max }) => temp >= min && temp <= max);
  return match ? match.id : null;
};

/**
 * like_temp 기반으로 emblem_id → name, desc 조회
 * @param {number} likeTemp 
 * @returns {Promise<{emblem_id, emblem_name, emblem_description} | null>}
 */
emblemAssigner.getEmblemInfoByLikeTemp = async (likeTemp) => {
  const emblemId = emblemAssigner.getEmblemIdByLikeTemp(likeTemp);
  if (!emblemId) return null;

  const query = `
    SELECT emblem_id, emblem_name, emblem_description
    FROM main_schema.emblems
    WHERE emblem_id = $1
  `;
  const result = await db.query(query, [emblemId]);
  return result.rows[0] || null;
};

module.exports = emblemAssigner;
