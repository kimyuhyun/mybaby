const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const requestIp = require('request-ip');

async function setLog(req, res, next) {
    const ip = req.sessionID;

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

router.get('/get_push/:id', setLog, async function(req, res, next) {
    const id = req.params.id;

    await new Promise(function(resolve, reject) {
        const sql = `SELECT is_push FROM MEMB_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/get_gbn/:id', setLog, async function(req, res, next) {
    const id = req.params.id;
    var arr = [];
    var cnt  = 0;

    //메뉴 있는지 확인
    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt FROM GBN_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0].cnt);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data;
    });
    //

    if (cnt == 0) {
        //카테고리 넣어주기!!
        var gbns = ["pmilk","bmilk","babyfood","diaper","sleep","bath","hosp","temp","drug","snack","water","milk","play","etc"];
        for (var i in gbns) {
            await new Promise(function(resolve, reject) {
                sql = 'INSERT INTO GBN_tbl SET id = ?, gbn = ?, sort1 = ?';
                db.query(sql, [id, gbns[i], i], function(err, rows, fields) {
                    if (!err) {
                        resolve();
                    } else {
                        console.log(err);
                        res.send(err);
                        return;
                    }
                });
            }).then();
        }
        //
    }

    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, gbn FROM GBN_tbl WHERE id = ? ORDER BY sort1 ASC`;
        db.query(sql, id, function(err, rows, fields) {
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


router.post('/set_gbn_sort/:id', setLog, async function(req, res, next) {
    const id = req.params.id;
    const idxs = req.body.idxs;

    var tmp = idxs.split(',');

    for (i in tmp) {
        if (i > 0) {
            await new Promise(function(resolve, reject) {
                const sql = `UPDATE GBN_tbl SET sort1 = ? WHERE idx = ?`;
                db.query(sql, [i, tmp[i]], function(err, rows, fields) {
                    if (!err) {
                        resolve();
                    } else {
                        console.log(err);
                    }
                });
            }).then();
        }
    }
    res.send({ code: 1 });
});



router.post('/set_qmemo', setLog, async function(req, res, next) {
    const { id, memo } = req.body;

    var cnt = 0;
    var obj = {};

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt FROM QMEMO_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.cnt;
    });

    await new Promise(function(resolve, reject) {
        var sql = '';
        if (cnt == 0) {
            sql = `INSERT INTO QMEMO_tbl SET memo = ?, id = ?`;
        } else {
            sql = `UPDATE QMEMO_tbl SET memo = ? WHERE id = ?`;
        }
        db.query(sql, [memo, id], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        obj = utils.nvl(data);
    });
    res.send(obj);
});

router.get('/get_qmemo/:id', setLog, async function(req, res, next) {
    const id = req.params.id;
    var obj = {};
    await new Promise(function(resolve, reject) {
        const sql = `SELECT memo FROM QMEMO_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
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


router.get('/get_inoculation_all/:pid', setLog, async function(req, res, next) {
    const today = moment().format('YYYY-MM-DD');
    const pid = req.params.pid;
    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, title, place, sdate, edate, is_free FROM INOCULATION_tbl WHERE edate >= ? ORDER BY sdate ASC `;
        console.log(sql);
        db.query(sql, today, function(err, rows, fields) {
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

    var rows = [];
    var i = 0;
    for (obj of tmpArr) {
        i++;
        obj.group = i;
        arr.push(obj);
        await new Promise(function(resolve, reject) {
            const sql = `SELECT idx, memo, created FROM INOCULATION_MEMO_tbl WHERE pid = ? AND inoc_idx = ?  ORDER BY idx ASC `;
            db.query(sql, [pid, obj.idx], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            rows = utils.nvl(data);
            for (row of rows) {
                row.group = i;
                row.sdate = obj.sdate;
                arr.push(row);
            }
        });
    }

    res.send(arr);
});

router.get('/get_inoculation_memo/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;
    var articleArr = [];
    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        const sql = `SELECT DISTINCT inoc_idx FROM INOCULATION_MEMO_tbl WHERE pid = ? ORDER BY idx DESC `;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        for (row of data) {
            articleArr.push(row.inoc_idx);
        }
    });

    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, title, place, sdate, edate, is_free FROM INOCULATION_tbl WHERE idx IN (${articleArr}) ORDER BY sdate ASC `;
        db.query(sql, function(err, rows, fields) {
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

    var rows = [];
    var i = 0;
    for (obj of tmpArr) {
        i++;
        obj.group = i;
        arr.push(obj);
        await new Promise(function(resolve, reject) {
            const sql = `SELECT idx, memo, created FROM INOCULATION_MEMO_tbl WHERE pid = ? AND inoc_idx = ?  ORDER BY idx ASC `;
            db.query(sql, [pid, obj.idx], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            rows = utils.nvl(data);
            for (row of rows) {
                row.group = i;
                row.sdate = obj.sdate;
                arr.push(row);
            }
        });
    }

    res.send(arr);
});

router.get('/', setLog, async function(req, res, next) {


    // await new Promise(function(resolve, reject) {
    //     var sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //
    //         } else {
    //             console.log(err);
    //         }
    //     });
    // }).then(function(data) {
    //
    // });


    res.send('api');
});


module.exports = router;
