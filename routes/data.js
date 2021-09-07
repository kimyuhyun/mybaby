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


router.get('/get_data/:baby_idx', setLog, async function(req, res, next) {
    const baby_idx = req.params.baby_idx;
    var end = '';
    var start = '';

    await new Promise(function(resolve, reject) {
        const sql = `SELECT sdate FROM DATA_tbl WHERE baby_idx = ? ORDER BY sdate DESC`;
        db.query(sql, baby_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data.length > 0) {
            start = data[data.length-1].sdate;
            end = data[0].sdate;
        }
    });

    var arr = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT sdate, SUM(ml) as ml FROM DATA_tbl WHERE baby_idx = ? AND sdate BETWEEN ? AND ? GROUP BY sdate ORDER BY sdate DESC`;
        db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.header = utils.nvl(data);
    });

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.idx,
            A.gbn,
            A.sdate,
            A.stm,
            A.edate,
            A.etm,
            A.memo,
            A.ml,
            A.val
            FROM
            DATA_tbl as A
            WHERE A.baby_idx = ?
            AND sdate BETWEEN ? AND ?
            ORDER BY sdate DESC, stm DESC`;
        db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.body = utils.nvl(data);
    });
    
    res.send(arr);
});

router.get('/get_data_last_one/:baby_idx', setLog, async function(req, res, next) {
    const baby_idx = req.params.baby_idx;

    var obj = {};

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.idx,
            A.gbn,
            A.sdate,
            A.stm,
            A.edate,
            A.etm,
            A.memo,
            A.ml,
            (SELECT SUM(ml) FROM DATA_tbl WHERE baby_idx = A.baby_idx AND sdate = A.sdate) as ml_sum,
            A.val
            FROM
            DATA_tbl as A
            WHERE A.baby_idx = ?
            ORDER BY idx DESC
            LIMIT 0, 1`;
        db.query(sql, baby_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        obj = utils.nvl(data);
    });

    res.send(obj);
});

router.get('/get_data_detail/:idx', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    var arr = {};
    await new Promise(function(resolve, reject) {
        const sql = `SELECT A.* FROM DATA_tbl as A WHERE A.idx = ? `;
        db.query(sql, idx, function(err, rows, fields) {
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

router.get('/get_time_line/:baby_idx/:gbn/:start/:end', setLog, async function(req, res, next) {
    const { baby_idx, gbn, start, end } = req.params;

    var arr = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT sdate, SUM(ml) as ml FROM DATA_tbl WHERE baby_idx = ? AND gbn = ? AND sdate BETWEEN ? AND ? GROUP BY sdate ORDER BY sdate DESC`;
        db.query(sql, [baby_idx, gbn, start, end], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.header = utils.nvl(data);
    });

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.idx,
            A.gbn,
            A.sdate,
            A.stm,
            A.edate,
            A.etm,
            A.memo,
            A.ml,
            A.val
            FROM
            DATA_tbl as A
            WHERE A.baby_idx = ?
            AND gbn = ?
            AND sdate BETWEEN ? AND ?
            ORDER BY sdate DESC, stm DESC`;
        db.query(sql, [baby_idx, gbn, start, end], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.body = utils.nvl(data);
    });

    res.send(arr);
});

router.get('/get_health/:baby_idx', setLog, async function(req, res, next) {
    const baby_idx = req.params.baby_idx;
    //diaper, hosp, temp, drug
    var arr = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT sdate, COUNT(*) as cnt FROM DATA_tbl WHERE baby_idx = ? AND gbn IN('diaper','hosp','temp','drug') GROUP BY sdate ORDER BY sdate DESC`;
        db.query(sql, baby_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.header = utils.nvl(data);
    });

    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, gbn, sdate, stm, edate, etm, ml, memo, val FROM DATA_tbl WHERE baby_idx = ? AND gbn IN('diaper','hosp','temp','drug') ORDER BY sdate DESC, stm DESC`;
        db.query(sql, baby_idx, function(err, rows, fields) {
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
        arr.body = utils.nvl(data);
    });
    res.send(arr);
});

module.exports = router;
