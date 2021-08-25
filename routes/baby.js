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



router.get('/get_baby/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;
    var arr = [];

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.idx,
            A.filename0,
            A.is_default,
            A.p_is_default,
            A.name1,
            A.birth,
            A.due_birth,
            (SELECT COUNT(*) FROM MEMB_tbl WHERE pid = A.pid) as parent_cnt
            FROM BABY_tbl as A
            WHERE A.pid = ? ORDER BY A.modified DESC`;
        db.query(sql, pid, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});


router.get('/get_baby_detail/:idx', setLog, async function(req, res, next) {
    const idx = req.params.idx;

    var arr = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT * FROM BABY_tbl WHERE idx = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });

    res.send(arr);
});

router.get('/set_baby_default/:idx/:pid/:is_parent', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    const pid = req.params.pid;
    const is_parent = req.params.is_parent;
    var sql = '';

    //디폴트값 초기화
    await new Promise(function(resolve, reject) {
        if (is_parent == '1') {
            sql = `UPDATE BABY_tbl SET p_is_default = 0 WHERE pid = ?`;
        } else {
            sql = `UPDATE BABY_tbl SET is_default = 0 WHERE pid = ?`;
        }
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then();
    //

    await new Promise(function(resolve, reject) {
        if (is_parent == '1') {
            sql = `UPDATE BABY_tbl SET p_is_default = 1, modified = NOW() WHERE idx = ?`;
        } else {
            sql = `UPDATE BABY_tbl SET is_default = 1, modified = NOW() WHERE idx = ?`;
        }

        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});



module.exports = router;
