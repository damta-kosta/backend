const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const emblemModel = require("../models/emblemModel");

// POST /emblem/assign 엠블럼 등록 (서버가 UUID 생성)
router.post("/assign", async (req, res) => {
  const { emblem_name, emblem_description } = req.body;

  if (!emblem_name || !emblem_description) {
    return res.status(400).json({ message: "필수 항목이 누락되었습니다." });
  }

  try {
    const exists = await emblemModel.exists(emblem_name);

    if (exists) {
      return res.status(200).json({
        message: "이미 존재하는 엠블럼입니다.",
        emblem: {
          emblem_name
        }
      });
    }

    const emblem_id = uuidv4();
    await emblemModel.createEmblem(emblem_id, emblem_name, emblem_description);

    return res.status(201).json({
      message: "엠블럼이 등록되었습니다.",
      emblem: {
        emblem_id,
        emblem_name
      }
    });

  } catch (err) {
    console.error("엠블럼 등록 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /emblems
router.get("/", async (req, res) => {
  try {
    const emblems = await emblemModel.getAll();

    res.status(200).json({
      count: emblems.length,
      emblems
    });
  } catch (err) {
    console.error("엠블럼 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});


// /emblems/:emblem_name
router.delete("/:emblem_name", async (req, res) => {
  const { emblem_name } = req.params;

  try {
    const exists = await emblemModel.exists(emblem_name);

    if (!exists) {
      return res.status(404).json({ message: "존재하지 않는 엠블럼입니다." });
    }

    await emblemModel.deleteByName(emblem_name);

    res.status(200).json({
      message: "엠블럼이 삭제되었습니다.",
      emblem_name
    });
  } catch (err) {
    console.error("엠블럼 삭제 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});


module.exports = router;
