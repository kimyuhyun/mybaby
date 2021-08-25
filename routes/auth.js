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



router.post('/register', setLog, async function(req, res, next) {
    const { id, name1, filename0, email } = req.body;

    var sql = '';
    var cnt = 0;
    var pid = id;

    await new Promise(function(resolve, reject) {
        sql = `SELECT COUNT(*) cnt, pid FROM MEMB_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        cnt = data.cnt;
        if (data.pid) {
            pid = data.pid;
        }
    });

    console.log('cnt', cnt);

    if (cnt == 0) {
        await new Promise(function(resolve, reject) {
            sql = 'INSERT INTO MEMB_tbl SET pid = ?, id = ?, name1 = ?, filename0 = ?, email = ?, level1 = 9, created = NOW(), modified = NOW()';
            db.query(sql, [pid, id, name1, filename0, email], function(err, rows, fields) {
                if (!err) {
                    resolve();
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then();

        res.send({
            code: 1,
            pid: pid,
            is_baby: false
        });
    } else {
        var is_baby = false;
        await new Promise(function(resolve, reject) {
            sql = `SELECT COUNT(*) cnt FROM BABY_tbl WHERE pid = ?`;
            db.query(sql, pid, function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows[0].cnt);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            if (data > 0) {
                is_baby = true;
            }
        });

        sql = "UPDATE MEMB_tbl SET modified = NOW() WHERE id = ?";
        db.query(sql, id);

        res.send({
            code: 1,
            pid: pid,
            is_baby: is_baby
        });
    }
});

router.get('/set_pid/:idx/:id', setLog, async function(req, res, next) {
    const { idx, id } = req.params;

    var pid = '';
    await new Promise(function(resolve, reject) {
        const sql = `SELECT pid FROM MEMB_tbl WHERE idx = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (data) {
            pid = data.pid;
        }
    });

    if (!pid) {
        res.send({ code: 0 });
        return;
    }

    //pid를 업데이트
    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl set pid = ? WHERE id = ?`;
        db.query(sql, [pid, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then();
    //

    //baby 정보 불러오기!
    var obj = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT GROUP_CONCAT(name1) as name1 FROM BABY_tbl WHERE pid = ?`;
        db.query(sql, pid, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (!data) {
            obj.code = 0;
        } else {
            obj.code = 1;
            obj.pid = pid;
            obj.name1 = data.name1;
        }
    });
    res.send(obj);
});

router.get('/', setLog, async function(req, res, next) {
    res.send('auth');
});

module.exports = router;
