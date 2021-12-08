const fs = require('fs');
const db = require('./db');
const requestIp = require('request-ip');
const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment');

class Utils {
    setSaveMenu(req) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (req.query.name1 != null) {
                db.query('SELECT * FROM SAVE_MENU_tbl WHERE link = ? AND id = ?', [CURRENT_URL, req.session.mid], function(err, rows, fields) {
                    if (!err) {
                        if (rows.length == 0) {
                            var sql = `
                                INSERT INTO SAVE_MENU_tbl SET
                                id = ?,
                                name1 = ?,
                                link = ? `;
                            db.query(sql, [req.session.mid, req.query.name1, CURRENT_URL], function(err, rows, fields) {
                                self.getSaveMenu(req).then(function(data) {
                                    resolve(data);
                                });
                            });
                        } else {
                            self.getSaveMenu(req).then(function(data) {
                                resolve(data);
                            });
                        }
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                self.getSaveMenu(req).then(function(data) {
                    resolve(data);
                });
            }
        });
    }

    getSaveMenu(req) {
        return new Promise(function(resolve, reject) {
            if (req.session.mid != null) {
                db.query("SELECT * FROM SAVE_MENU_tbl WHERE id = ?", req.session.mid, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                resolve(0);
            }
        });
    }

    async sendPush(id, msg, menu_flag) {
        var fcmArr = [];
        var rs = {};
        await new Promise(function(resolve, reject) {
            var sql = "SELECT fcm FROM MEMB_tbl WHERE id = ? AND is_push = 1 AND is_logout = 0"
            db.query(sql, id, function(err, rows, fields) {
                console.log(rows.length);
                if (!err) {
                    if (rows.length > 0) {
                        resolve({ code: 1, msg: rows});
                    } else {
                        console.log(id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.');
                        resolve({ code: 0, msg: id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.'});
                    }
                } else {
                    resolve({ code: 0, msg: err});
                }
            });
        }).then(function(data) {
            rs = data;
        });

        if (rs.code == 0) {
            return rs;
        } else {
            for (var obj of rs.msg) {
                fcmArr.push(obj.fcm);
            }
        }

        var fields = {};
        fields.priority = 'high';
        fields.registration_ids = fcmArr;

        fields.data = {};
        fields.data.menu_flag = menu_flag;               //키값은 대문자 안먹음..
        fields.data.title = 'Mybaby';
        fields.data.body = msg;

        // fields.notification = {};
        // fields.notification.title = 'Mybaby';
        // fields.notification.body = msg;
        // fields.notification.click_action = 'noti_click'; //액티비티 다이렉트 호출

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            data: JSON.stringify(fields),
        };

        var result = '';
        await axios(config).then(function (response) {
            //알림내역저장
            if (response.data.success == 1) {
                for (var targetId of fcmArr) {
                    const sql = "INSERT INTO PUSH_HISTORY_tbl SET target_id = ?, message = ?, created = NOW()";
                    db.query(sql, [targetId, fields.data.body]);
                }
            }
            //
            result = response.data;
        }).catch(function (error) {
            result = error;
        });

        // console.log('result', result);

        return result;
    }

    async sendArticlePush(id, msg, idx, writer, board_id) {
        var fcmArr = [];
        var rs = {};
        await new Promise(function(resolve, reject) {
            var sql = "SELECT fcm FROM MEMB_tbl WHERE id = ? AND is_push = 1 AND is_logout = 0"
            db.query(sql, id, function(err, rows, fields) {
                console.log(rows.length);
                if (!err) {
                    if (rows.length > 0) {
                        resolve({ code: 1, msg: rows});
                    } else {
                        console.log(id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.');
                        resolve({ code: 0, msg: id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.'});
                    }
                } else {
                    resolve({ code: 0, msg: err});
                }
            });
        }).then(function(data) {
            rs = data;
        });

        if (rs.code == 0) {
            return rs;
        } else {
            for (var obj of rs.msg) {
                fcmArr.push(obj.fcm);
            }
        }

        var fields = {};
        fields.priority = 'high';
        fields.registration_ids = fcmArr;

        fields.data = {};
        fields.data.title = 'Mybaby';
        fields.data.body = msg;
        fields.data.idx = idx;
        fields.data.writer = writer;
        fields.data.board_id = board_id;


        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            data: JSON.stringify(fields),
        };

        var result = '';
        await axios(config).then(function (response) {
            //알림내역저장
            if (response.data.success == 1) {
                for (var targetId of fcmArr) {
                    const sql = "INSERT INTO PUSH_HISTORY_tbl SET target_id = ?, message = ?, created = NOW()";
                    db.query(sql, [targetId, fields.data.body]);
                }
            }
            //
            result = response.data;
        }).catch(function (error) {
            result = error;
        });

        // console.log('result', result);

        return result;
    }

    //null 값은 빈값으로 처리해준다!!
    async nvl(arr) {
        if (arr == null) {
            return arr;
        }

        if (arr.length != null) {
            for (var rows of arr) {
                for (var i in rows) {
                    if (rows[i] == null || rows[i] == 'null') {
                        rows[i] = '';
                    }
                }
            }
        } else {
            for (var i in arr) {
                if (arr[i] == null || arr[i] == 'null') {
                    arr[i] = '';
                }
            }
        }
        return arr;
    }

    //수면시간 가져오기!!
    async getSleepCount(baby_idx, start, end) {
        if (!end) {
            end = start;
        }

        var rtn_value = '';
        var cnt = 0;
        var ttl_time = 0;

        await new Promise(function(resolve, reject) {
            const sql = `SELECT COUNT(*) as cnt FROM DATA_tbl WHERE gbn = 'sleep' AND baby_idx = ? AND sdate BETWEEN ? AND ?`;
            db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
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
            const sql = `SELECT idx, sdate, stm, edate, etm FROM DATA_tbl WHERE gbn = 'sleep' AND etm != '' AND baby_idx = ? AND sdate BETWEEN ? AND ? ORDER BY sdate ASC, idx DESC`;
            db.query(sql, [baby_idx, start, end], function(err, rows, fields) {
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            for (var obj of data) {
                if (!obj.edate) {
                    obj.edate = obj.sdate;
                }
                const stm = moment(obj.sdate + ' ' + obj.stm);
                const etm = moment(obj.edate + ' ' + obj.etm);
                const diff = etm.diff(stm, 'minute');
                console.log(obj.idx, diff);
                if (diff < 0) {
                    ttl_time += diff * -1;
                } else {
                    ttl_time += diff;
                }

            }
        });

        var h = parseInt(ttl_time / 60);
        var m = ttl_time % 60;


        rtn_value = cnt + `(${h.toFixed(0)}h${m.toFixed(0)}m)`;

        return rtn_value;
    }
}

module.exports = new Utils();
