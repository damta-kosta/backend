var express = require('express');
var router = express.Router();

const roomModules = require('../models/roomsModel');

// rooms router
// POST /rooms/
router.post('/', async (req, res, next) => {
    const params = req.query;
    const ret = await roomModules.createRoom(params);

    res.json(ret);
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