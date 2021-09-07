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



router.get('/get_baby/:pid/:id', setLog, async function(req, res, next) {
    const pid = req.params.pid;
    const id = req.params.id;

    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.idx,
            A.filename0,
            A.name1,
            A.birth,
            A.due_birth,
            (SELECT COUNT(*) FROM MEMB_tbl WHERE pid = A.pid) as parent_cnt
            FROM BABY_tbl as A
            WHERE A.pid = ? ORDER BY A.modified DESC `;
        db.query(sql, pid, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        tmpArr = utils.nvl(data);
    });

    //나의 기본 baby 가져오기!!
    var my_baby_idx = 0;
    await new Promise(function(resolve, reject) {
        const sql = `SELECT baby_idx FROM MY_DEFAULT_BABY_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data) {
            my_baby_idx = data.baby_idx;
        }
    });

    if (my_baby_idx == 0) {
        for (i in tmpArr) {
            tmpArr[i].default = 0;
            if (i == 0) {
                tmpArr[i].default = 1;
            }
            arr.push(tmpArr[i]);
        }
    } else {
        for (obj of tmpArr) {
            obj.default = 0;
            if (obj.idx == my_baby_idx) {
                obj.default = 1;
            }
            arr.push(obj);
        }
    }



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


router.get('/set_baby_default/:baby_idx/:id', setLog, async function(req, res, next) {
    const baby_idx = req.params.baby_idx;
    const id = req.params.id;

    //기존것들 다 지우고!!
    await new Promise(function(resolve, reject) {
        const sql = `DELETE FROM MY_DEFAULT_BABY_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then();

    await new Promise(function(resolve, reject) {
        const sql = 'INSERT INTO MY_DEFAULT_BABY_tbl SET id = ?, baby_idx = ?';
        db.query(sql, [id, baby_idx], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then();
    res.send({ code: 1 });
});

router.post('/set_baby_info', setLog, async function(req, res, next) {
    var idx = req.body.idx;
    const id = req.body.id;
    const relation = req.body.relation;

    delete req.body.idx;
    delete req.body.id;
    delete req.body.relation;

    var sql = "";
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != 'null') {
            sql += `, ${key} = ? `;
            records.push(req.body[key]);
        }
    }
    sql = sql.substring(1);


    await new Promise(function(resolve, reject) {
        if (idx) {
            records.push(idx);
            sql = `UPDATE BABY_tbl SET ${sql}, modified = NOW() WHERE idx = ?`;
        } else {
            sql = `INSERT INTO BABY_tbl SET ${sql}, created = NOW(), modified = NOW()`;
        }
        db.query(sql, records, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (!idx) {
            idx = data.insertId;        //baby_idx 임
        }
    });

    //나의 관계 테이블에 넣는다!!
    var cnt  = 0;
    await new Promise(function(resolve, reject) {
        sql = `SELECT COUNT(*) as cnt FROM MY_RELATION_tbl WHERE baby_idx = ? AND id = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            // console.log(rows);
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
    });

    if (cnt == 0) {
        sql = `INSERT INTO MY_RELATION_tbl SET baby_idx = ?, id = ?, relation = ? `;
        db.query(sql, [idx, id, relation]);
    } else {
        sql = `UPDATE MY_RELATION_tbl SET relation = ? WHERE baby_idx = ? AND id = ? `;
        db.query(sql, [relation, idx, id]);
    }
    //

    res.send({ code: 1 });

});

router.get('/', setLog, async function(req, res, next) {

    // var arr = [];
    // await new Promise(function(resolve, reject) {
    //     const sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //             resolve(rows);
    //         } else {
    //             console.log(err);
    //             res.send(err);
    //             return;
    //         }
    //     });
    // }).then(function(data) {
    //     arr = utils.nvl(data);
    // });
    // res.send(arr);

    res.send('baby');
});

module.exports = router;
