var express = require('express');
var router = express.Router();

// rooms router

// POST /rooms/
router.post('/', async (req, res, next) => {
    /**
     * TODO: 방 만들기
     * 방 고유번호, 
     * 방 이름, 
     * 방 호스트, 
     * 방 제목, 
     * 방 설명(생략 가능), 
     * 최대 참여 가능 인원 2 ~ 4 명,
     * 현재 참여 인원 (Foreign Key), 
     * 약속 시간
     * 방 thumbnail (defualt: 기본 이미지)
     */
});

// PATCH /rooms/:id
router.patch('/:id', async (req, res, next) => {

});

// PATCH /rooms/:id/deactivate 
router.patch('/:id/deactivate', async (req, res, next) => {});

// GET /rooms/:id/participants 
router.get('/:id/participants', async (req, res, next) => {});

// GET /rooms/:id/participants/me
router.get("/:id/participants/me", async (req, res, next) => {});

// POST /rooms/:id/join 
router.post("/:id/join", async (req, res, next) => {});

// POST /rooms/:id/leave   
router.post("/:id/leave", async (req, res, next) => {});

// PATCH /rooms/:id/participants/:userId
router.patch("/:id/participants/:userId", async (req, res, next) => {});

module.exports = router;