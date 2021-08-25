var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');
var menus = require('../menu');
var utils = require('../Utils');

//메뉴를 전역변수에 넣어준다!
global.MENUS = menus;
global.SAVE_MENUS;
global.CURRENT_URL;
//

function userChecking(req, res, next) {
    // if (process.env.NODE_ENV != 'development') {
        if (req.session.mid == null) {
            res.redirect('/admin/login');
            return;
        }
    // }

    CURRENT_URL = req.baseUrl + req.path;

    utils.setSaveMenu(req).then(function(data) {
        SAVE_MENUS = data;
        next();
    });
}

router.get('/', userChecking, function(req, res, next) {
    db.query("SELECT show_menu_link FROM GRADE_tbl WHERE level1 = '?'", req.session.level1, function(err, rows, fields) {
        if (!err) {
            var tmp = "";
            if (rows.length > 0) {
                tmp = rows[0].show_menu_link.substr(1, 9999).split(',');
            }
            res.render('./admin/main', {
                show_menu_link: tmp,
                level1: req.session.level1,
            });
        } else {
            res.send(err);
        }
    });
});

router.get('/login', function(req, res, next) {
    res.render('./admin/login', {
        year: new Date().getFullYear(),
        id: req.cookies['id'],
        pw: req.cookies['pw'],
    });
});

router.get('/logout', function(req, res, next) {
    // res.clearCookie('id', {
    //     path: '/'
    // });
    // res.clearCookie('name1', {
    //     path: '/'
    // });
    // res.clearCookie('level1', {
    //     path: '/'
    // });
    req.session.destroy(function(){
        res.clearCookie('sid');
        res.send('<script type="text/javascript">alert("로그아웃 되었습니다.");location.href="/admin/login"</script>');
    });
});



// POST 는 body 로 받는다!!!
router.post('/login', function(req, res, next) {
    db.query("SELECT idx, id, name1, level1 FROM MEMB_tbl WHERE id = ? AND pass1 = PASSWORD(?)", [req.body.id, req.body.pw], function(err, rows, fields) {
        if (!err) {
            if (rows[0] != null) {
                //레벨체크
                if (rows[0].level1 > 2) {
                    res.send('<script type="text/javascript">alert("접근권한이 없습니다.");history.back();</script>');
                    return;
                }
                //

                db.query("UPDATE MEMB_tbl SET modified = NOW() WHERE id = ?", req.body.id);


                req.session.idx = rows[0].idx;
                req.session.mid = rows[0].id;
                req.session.name1 = rows[0].name1;
                req.session.level1 = rows[0].level1;

                if (req.body.remember == 1) {
                    res.cookie('id', rows[0].id, {
                        maxAge: 60 * 60 * 1000,
                        httpOnly: true,
                        path: '/'
                    });
                    res.cookie('pw', req.body.pw, {
                        maxAge: 60 * 60 * 1000,
                        httpOnly: true,
                        path: '/'
                    });
                } else {
                    res.clearCookie('id', {
                        path: '/'
                    });
                    res.clearCookie('pw', {
                        path: '/'
                    });
                }

                req.session.save(function() {
                    res.redirect('/admin');
                });
            } else {
                res.send('<script type="text/javascript">alert("아이디/패스워드가 일치 하지 않습니다.");history.back();</script>');
                return;
            }
        } else {
            console.log('err', err);
            res.send(err);
        }
    });
});



router.get('/my_profile', userChecking, function(req, res, next) {
    var sql = "SELECT * FROM MEMB_tbl WHERE idx = ?";

    db.query(sql, req.session.idx, function(err, rows, fields) {
        if (!err) {
            res.render('./admin/my_profile', {
                row: rows[0],
            });
        } else {
            console.log(err);
        }
    });
});


router.get('/page/:page', userChecking, function(req, res, next) {
    res.render('./admin/' + req.params.page, {
        myinfo: req.session,
        board_id: req.params.page,
    });
});

// GET 는 query 로 받는다!!!
router.get('/delete_menu', userChecking, function(req, res, next) {
    var idx = req.query.idx;
    db.query('DELETE FROM SAVE_MENU_tbl WHERE idx = ?', idx, function(err, rows, fields) {
        if (!err) {
            res.redirect('/admin');
        } else {
            console.log('err', err);
            res.send(err);
        }
    });
});


module.exports = router;
