const express = require("express");
const router = express.Router();
const communityModel = require("../models/communityModel");
const jwtMiddleware = require("../middlewares/jwtMiddleware");

// POST /community/write 게시글 작성
router.post("/write", jwtMiddleware, async (req, res) => {
  try {
    const {title, content, imageBase64 } = req.body;
    const userId = req.user.user_id;

    if(!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    const result = await communityModel.createPost(userId, title, content, imageBase64);
    res.status(201).json({ community_id: result.community_id, message: "게시글이 등록되었습니다." });
  }catch (err) {
    console.error("게시글 작성 오류:", err);
    if(err.status === 403) {
      res.status(403).json({ message: err.message });
    } else {
      res.status(500).json({ message: "게시글 등록 중 오류가 발생했습니다."});
    }
  }
})

// GET /community 최신순으로 게시글을 일정 개수만큼 조회 (cursor 기반)
router.get("/", async (req, res) => {
  try {
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit) || 20;

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

// GET /community/:id 게시글 상세 조회
router.get("/:id", async (req, res) => {
  try {
    const communityId = req.params.id;

    const post = await communityModel.getPostById(communityId);

    if(!post) {
      return res.status(404).json({ message: "존재하지 않거나 삭제된 게시글입니다." });
    }

    res.json({ post });
  } catch (err) {
    console.error("게시글 상세 조회 오류:", err);
    res.status(500).json({ message: "게시글 조회 중 오류가 발생했습니다." });
  }
});

// DELETE /community/:id/delete  게시글 삭제(soft delete)
router.delete("/:id/delete", jwtMiddleware, async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user?.user_id;

    if(!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    await communityModel.deletePost(communityId);
    res.json({ message: "게시글이 삭제되었습니다." });
  } catch (err) {
    console.error("게시글 삭제 오류:", err);
    if(err.status === 403 || err.status === 404) {
      res.status(err.status).json({ message: err.message });
    } else {
      res.status(500).json({ message: "게시글 삭제 중 오류가 발생했습니다." });
    }
  }
});

module.exports = router;
