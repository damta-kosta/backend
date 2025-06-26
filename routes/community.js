const express = require("express");
const router = express.Router();
const communityModel = require("../models/communityModel");

// POST /community/write 게시글 작성
router.post("/write", async (req, res) => {
  try {
    const {title, content, imageBase64 } = req.body;
    const userId = req.user.user_id;

    const result = await communityModel.createPost(userId, title, content, imageBase64);
    res.status(201).json({ community_id: result.community_id, message: "게시글이 등록되었습니다." });
  }catch (err) {
    console.error(err);
    res.status(500).json({ message: "게시글 등록 중 오류가 발생했습니다."});
  }
})

// GET /api/community 최신순으로 게시글을 일정 개수만큼 조회 (cursor 기반)
router.get("/", async (req, res) => {
  try {
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit) || 10;

    const posts = await communityModel.getPosts(cursor, limit);
    const hasNext = posts.length === limit;

let nextCursor = null;
if (hasNext && posts.length > 1) {
  const next = posts[posts.length - 2];
  nextCursor = next.create_at.toISOString();
}

    res.json({ community: posts, hasNext, nextCursor });
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "게시글 조회 중 오류가 발생했습니다." });
  }
});


// PATCH /api/community/:id/delete  게시글 삭제(soft delete)
router.patch("/:id/delete", async (req, res) => {
  try {
    const communityId = req.params.id;
    await communityModel.deletePost(communityId);
    res.json({ message: "게시글이 삭제되었습니다." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "게시글 삭제 중 오류가 발생했습니다." });
  }
});

module.exports = router;
