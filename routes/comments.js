const express = require("express");
const router = express.Router();
const commentModel = require("../models/commentModel");

// POST /comments/:communityId/write 댓글 작성
router.post("/:communityId/write", async (req, res) => {
  try {
    const { commentBody } = req.body;
    const communityId = req.params.communityId;
    const userId = req.user.user_id;

    const result = await commentModel.createComment(communityId, userId, commentBody);
    res.status(201).json({ comment_id: result.comment_id, message: "댓글이 등록되었습니다." });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "댓글 등록 중 오류가 발생했습니다." });
  }
});

// POST /comments/reply/:commentId 답글 작성
router.post("/reply/:commentId", async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const parentCommentId = req.params.commentId;
    const { replyBody } = req.body;
    const userId = req.user.user_id;

    const result = await commentModel.createReply(communityId, userId, replyBody, parentCommentId);
    res.status(201).json({ comment_id: result.comment_id, message: "답글이 등록되었습니다." });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "답글 등록 중 오류가 발생했습니다." });
  }
});

// GET /comments/:communityId/comments 댓글 목록 조회 (커서 기반 무한 스크롤)
router.get("/:communityId/comments", async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit) || 10;

    const comments = await commentModel.getComments(communityId, cursor, limit);
    const hasNext = comments.length === limit;
    const nextCursor = hasNext ? comments[comments.length - 1].create_at.toISOString() : null;

    res.json({ comments, hasNext, nextCursor });

  } catch(err) {
    console.error(err);
    res.status(500).json({ message: "댓글 조회 중 오류가 발생했습니다." });
  }
});

// PATCH /comments/comment/:commentId/delete 댓글 삭제
router.patch("/comment/:commentId/delete", async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.user_id;

    await commentModel.deleteComment(commentId, userId);
    res.json({ message: "댓글이 삭제되었습니다." });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message });
  }
});

// PATCH /comments/reply/:replyId/delete 답글 삭제
router.patch("/reply/:replyId/delete", async (req, res) =>{
  try {
    const replyId = req.params.replyId;
    const userId = req.user.user_id;

    await commentModel.deleteReply(replyId, userId);
    res.json({ message: "답글이 삭제되었습니다." });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message });
  }
});

module.exports = router;
