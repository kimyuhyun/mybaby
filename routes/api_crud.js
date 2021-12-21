const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const db = require('../db');
const utils = require('../Utils');
const FormData = require('form-data');
const axios = require('axios');


function tokenChecking(req, res, next) {
    //여기서 토큰 체크!

    //
    next();
}


router.post('/write', tokenChecking, async function(req, res, next) {
    let table = req.body.table;
    let idx = req.body.idx;
    let board_id = req.body.board_id;
    let id = req.body.id;
    let step = req.body.step;


    delete req.body.table;
    delete req.body.idx;
    delete req.body.created;
    delete req.body.modified;

    var sql = ""
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'pass1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }
            records.push(req.body[key]);
        }
    }

    // console.log(records);return;

    if (idx == null) {
        sql = `INSERT INTO ${table} SET ${sql} created = NOW(), modified = NOW()`;
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                var arr = {};
                arr.code = 1;
                arr.msg = '등록 되었습니다.';
                res.send(arr);

                //성장일기라면...광역푸시를 날린다!!!
                console.log(board_id, step);
                if (board_id == 'growth' && step == 1) {
                    growthPush(rows.insertId, id);
                } else if (board_id == 'singo') {
                    singoPush();
                }
                //
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = `UPDATE ${table} SET ${sql} modified = NOW() WHERE idx = ?`;
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                var arr = {};
                arr.code = 2;
                arr.msg = '수정 되었습니다.';
                arr.record = rows[0];
                res.send(arr);
            } else {
                res.send(err);
            }
        });
    }
    // console.log(sql, records);
});

router.post('/delete', tokenChecking, async function(req, res, next) {
    const table = req.body.table;
    const idx = req.body.idx;
    const sql = "DELETE FROM " + table + " WHERE idx = ?";
    db.query(sql, idx);

    res.send({
        code: 1,
        msg: '삭제 되었습니다.'
     });
});

router.post('/reply_delete', tokenChecking, async function(req, res, next) {
    var table = req.query.table;
    var params = JSON.parse(req.body.request);
    console.log(params);
    var sql = ``;
    for (idx of params.selected) {
        sql = `UPDATE ${table} SET id='admin', name1='관리자', memo='삭제된 댓글 입니다.', filename0='' WHERE idx = ${idx}`;
        db.query(sql);
    }
    var arr = new Object();
    arr['code'] = 1;
    res.send(arr);
});


async function growthPush(idx, id) {
    var fcmArr = [];

    await new Promise(function(resolve, reject) {
        const sql = `SELECT fcm FROM MEMB_tbl WHERE pid = ? AND is_push = 1 AND is_logout = 0`;
        db.query(sql, id, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                return;
            }
        });
    }).then(async function(data) {
        for (var obj of await utils.nvl(data)) {
            fcmArr.push(obj.fcm);
        }
    });

    console.log('growthPush', idx, id, fcmArr);

    if (fcmArr.length == 0) {
        return;
    }

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
    }).catch(function (error) {
        console.log(error.response.data);
    });

}


async function singoPush() {
    var fcmArr = [];
    await new Promise(function(resolve, reject) {
        let sql = ` SELECT fcm FROM MEMB_tbl WHERE name1 = '김유현' `;
        db.query(sql, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                return;
            }
        });
    }).then(async function(data) {
        for (var obj of await utils.nvl(data)) {
            fcmArr.push(obj.fcm);
        }
    });
    if (fcmArr.length == 0) {
        return;
    }

    var fields = {};
    fields.priority = 'high';
    fields.registration_ids = fcmArr;

    fields.data = {};
    fields.data.title = 'Mybaby';
    fields.data.body = '신고가 접수되었습니다.';

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
    }).catch(function (error) {
        console.log(error.response.data);
    });
}

module.exports = router;
