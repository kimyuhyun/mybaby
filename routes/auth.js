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
    var { id, name1, filename0, email } = req.body;

    var sql = '';
    var cnt = 0;
    var pid = id;
    var idx = '';

    await new Promise(function(resolve, reject) {
        sql = `SELECT COUNT(*) cnt, pid, idx, name1, filename0, email FROM MEMB_tbl WHERE id = ?`;
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
        if (cnt > 0) {
            pid = data.pid;
            idx = data.idx;
            name1 = data.name1;
            filename0 = data.filename0;
            email = data.email;
        }
    });

    if (cnt == 0) {
        await new Promise(function(resolve, reject) {
            sql = 'INSERT INTO MEMB_tbl SET pid = ?, id = ?, name1 = ?, filename0 = ?, email = ?, level1 = 9, created = NOW(), modified = NOW()';
            db.query(sql, [pid, id, name1, filename0, email], function(err, rows, fields) {
                if (!err) {
                    resolve(row);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            idx = data.insertId;
        });

        res.send({
            code: 1,
            pid: pid,
            idx: idx,
            name1: name1,
            thumb: filename0,
            email: email,
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

        sql = "UPDATE MEMB_tbl SET is_logout = 0, modified = NOW() WHERE id = ?";
        db.query(sql, id);

        res.send({
            code: 1,
            pid: pid,
            idx: idx,
            name1: name1,
            thumb: filename0,
            email: email,
            is_baby: is_baby
        });
    }
});

router.get('/set_invite_code/:code/:id', setLog, async function(req, res, next) {
    const code = req.params.code;
    const id = req.params.id;

    var pid = '';
    await new Promise(function(resolve, reject) {
        const sql = `SELECT pid FROM INVITE_tbl WHERE idx = ?`;
        db.query(sql, code, function(err, rows, fields) {
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


    //pid를 업데이트
    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl set pid = ? WHERE id = ?`;
        db.query(sql, [pid, id], function(err, rows, fields) {
            // console.log(rows);
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



router.get('/get_invite_code/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;
    var cnt = 0;
    var code = 0;

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt, idx FROM INVITE_tbl WHERE pid = ?`;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (data.cnt != 0) {
            code = data.idx;
            cnt = data.cnt;
        } else {
            cnt = data.cnt;
        }
    });

    if (cnt == 0) {
        await new Promise(function(resolve, reject) {
            const sql = `INSERT INTO INVITE_tbl SET pid = ?`;
            db.query(sql, pid, function(err, rows, fields) {
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            idx = data.insertId;
        });
    }
    res.send({code: idx});
});

router.get('/', setLog, async function(req, res, next) {
    res.send('auth');
});

module.exports = router;
