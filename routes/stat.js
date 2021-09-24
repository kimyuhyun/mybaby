const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const HashMap = require('hashmap');

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
    }).then(function(data) {
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
    fs.writeFile('./liveuser/' + ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();
}


// router.get('/list/:baby_idx/:sort1/:start/:end', setLog, async function(req, res, next) {
//     const { baby_idx, sort1, start, end } = req.params;
//     var arr = [];
//     await new Promise(function(resolve, reject) {
//         const sql = `SELECT * FROM DATA_tbl WHERE baby_idx = ? AND sdate BETWEEN ? AND ? ORDER BY ${sort1}`;
//         db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
//             // console.log(rows);
//             if (!err) {
//                 resolve(rows);
//             } else {
//                 console.log(err);
//                 res.send(err);
//                 return;
//             }
//         });
//     }).then(function(data) {
//         arr = utils.nvl(data);
//     });
//     res.send(arr);
// });

router.get('/stat_list/:baby_idx/:start/:end', setLog, async function(req, res, next) {
    const { baby_idx, start, end } = req.params;
    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT gbn, COUNT(*) as cnt, SUM(ml) as ml FROM DATA_tbl WHERE baby_idx = ? AND sdate BETWEEN ? AND ? GROUP BY gbn`;
        db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
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
        arr = utils.nvl(data);
    });
    res.send(arr);
});

router.get('/ml_graph/:baby_idx/:start/:end', setLog, async function(req, res, next) {
    const { baby_idx, start, end } = req.params;

    const date1 = moment(start, "YYYY-MM-DD");
    const date2 = moment(end, "YYYY-MM-DD");
    const diff = date2.diff(date1, 'days');

    var gbnObj = {};
    var hashMap;

    gbnObj.bmilk = [];
    gbnObj.pmilk = [];
    gbnObj.milk = [];
    gbnObj.water = [];

    const keys = ['bmilk','pmilk','milk','water'];

    for (key of keys) {
        await new Promise(function(resolve, reject) {
            const sql = `SELECT SUM(ml) as ml, sdate FROM DATA_tbl WHERE baby_idx = ? AND gbn = ? AND sdate BETWEEN ? AND ? GROUP BY sdate`;
            db.query(sql, [baby_idx, key, start, end], function(err, rows, fields) {
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            hashMap = new HashMap();
            for (obj of utils.nvl(data)) {
                hashMap.set(moment(obj.sdate).format("DD"), obj.ml);
            }
        });

        for (var i = 0; i <= diff; i++) {
            const day = moment(start).add(i, 'days').format("DD");
            var obj = {};
            obj.day = day;

            if (hashMap.get(day)) {
                obj.ml = hashMap.get(day);
            } else {
                obj.ml = 0;
            }

            if (key == 'bmilk') {
                gbnObj.bmilk.push(obj);
            } else if (key == 'pmilk') {
                gbnObj.pmilk.push(obj);
            } else if (key == 'milk') {
                gbnObj.milk.push(obj);
            } else if (key == 'water') {
                gbnObj.water.push(obj);
            }
        }
    }
    res.send(gbnObj);
});


router.get('/action_graph/:baby_idx/:start/:end', setLog, async function(req, res, next) {
    const { baby_idx, start, end } = req.params;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt, gbn FROM DATA_tbl WHERE baby_idx = ? AND sdate BETWEEN ? AND ? GROUP BY gbn`;
        db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});


router.get('/growth_graph/:baby_idx', setLog, async function(req, res, next) {
    const baby_idx = req.params.baby_idx;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT title, SUM(height1) as height1, SUM(weight) as weight, SUM(head_size) as head_size FROM BOARD_tbl WHERE baby_idx = ? AND board_id = 'growth' GROUP by title `;
        db.query(sql, baby_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
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

    res.send('stat');
});



module.exports = router;
