const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const axios = require('axios');


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

//성장일기 테스트!
// http://localhost:3001/push/gtest
router.get('/gtest', setLog, async function(req, res, next) {
    var idx = 397;
    var fcmArr = ['caqQTmm8SIiSW_GE8TN9Wr:APA91bFFldVw_vLIlFkm1CS-jhoK9f2AvBq8w3mXeYvnknTEaCAI_TnYDwamNn4-CS3HFweTGQsuJ_Eb0E7OSHELqlokzDbgrMXXxxjpAdY3HnRwQFgEgXRZPNHoorJQwnGyImPdYJ7Y'];
    var id = '108361624945950794346';

    var fields = {};
    fields.priority = 'high';
    fields.registration_ids = fcmArr;

    fields.data = {};
    fields.data.title = 'Mybaby';
    fields.data.body = '성장일기가 등록되었습니다.';
    fields.data.idx = idx;
    fields.data.writer = id;
    fields.data.board_id = 'growth';
    var config = {
        method: 'post',
        url: 'https://fcm.googleapis.com/fcm/send',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + process.env.FCM_SERVER_KEY
        },
        data: JSON.stringify(fields),
    };

    await axios(config).then(function (response) {
        //알림내역저장
        if (response.data.success == 1) {
            for (var targetId of fcmArr) {
                const sql = "INSERT INTO PUSH_HISTORY_tbl SET target_id = ?, message = ?, created = NOW()";
                db.query(sql, [targetId, fields.data.body]);
            }
        }
        //

        res.send(response.data)
    }).catch(function (error) {
        console.log(error.response.data);
    });


});





module.exports = router;
