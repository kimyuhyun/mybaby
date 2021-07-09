const fs = require('fs');
const db = require('./db');

class Utils {
    setSaveMenu(req) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (req.query.name1 != null) {
                db.query('SELECT * FROM SAVE_MENU_tbl WHERE link = ? AND id = ?', [CURRENT_URL, req.session.usr_id], function(err, rows, fields) {
                    if (!err) {
                        if (rows.length == 0) {
                            var sql = `
                                INSERT INTO SAVE_MENU_tbl SET
                                id = ?,
                                name1 = ?,
                                link = ? `;
                            db.query(sql, [req.session.usr_id, req.query.name1, CURRENT_URL], function(err, rows, fields) {
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
            if (req.session.usr_id != null) {
                db.query("SELECT * FROM SAVE_MENU_tbl WHERE id = ?", req.session.usr_id, function(err, rows, fields) {
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
}

module.exports = new Utils();
