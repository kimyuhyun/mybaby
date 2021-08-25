const fs = require('fs');
const db = require('./db');

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

    //null 값은 빈값으로 처리해준다!!
    nvl(arr) {
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
}

module.exports = new Utils();
