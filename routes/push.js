const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');


async function setLog(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT visit FROM ANALYZER_tbl WHERE ip = ? ORDER BY idx DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET ip = ?, agent = ?, visit = ?, created = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].visit + 1;
            db.query(sql, [ip, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [ip, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();
}


// http://localhost:3001/push?id=108542488160175627490&msg=TEST&menu_flag=1
router.get('/', setLog, async function(req, res, next) {
    let id = req.query.id;
    let msg = req.query.msg;
    let menu_flag = req.query.menu_flag;

    let result = await utils.sendPush(id, msg, menu_flag);

    res.send(result);
});

// http://localhost:3001/push/article?id=108542488160175627490&msg=댓글이달렸다!!!!&idx=142&writer=admin&board_id=free
router.get('/article', setLog, async function(req, res, next) {
    let id = req.query.id;
    let msg = req.query.msg;
    let idx = req.query.idx;
    let writer = req.query.writer;
    let board_id = req.query.board_id;

    let result = await utils.sendArticlePush(id, msg, idx, writer, board_id);

    res.send(result);
});



module.exports = router;
