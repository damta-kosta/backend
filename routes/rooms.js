var express = require('express');
var router = express.Router();

const roomModules = require('../models/roomsModel');

// rooms router
// POST /rooms/
/**
 * need info
 * 방 생성 모듈
 * roomTitle (방 제목),
 * roomHost (방 호스트),
 * roomDescription (방 설명 (생략 가능)),
 * maxParticipants (최대 참여 가능 인원 (2 ~ 4명)),
 * currentParticipants (현재 참여 인원 (host uuid)),
 * roomEndedAt (방 종료 시간),
 * roomThumbnailImg (방 썸네일 이미지)
 */
router.post('/', async (req, res, next) => {
    const body = req.body;
    const ret = {
        res: {}
    };
    const isHost = await roomModules.isHost(body.roomHost);

    if(!isHost) ret.res = await roomModules.createRoom(body);
    else ret.res.message = "모임방을 생성하는데 문제가 발생하였습니다."

    res.json(ret.res);
});

// PATCH /rooms/:id
/**
 * 방 정보 수정
 */
router.patch('/:id', async (req, res, next) => {
    const body = req.body;
    
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