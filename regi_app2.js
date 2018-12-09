const express = require('express');
const mysql = require('mysql');
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
//var Promise = require('bluebird');
const util = require('util');
const cluster = require('cluster');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(express.static(__dirname + '/public'));
app.use(cors());
//app.engine('html', require('ejs').renderFile);

if (cluster.isMaster) {
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    cluster.on('exit', function (worker) {

        // Replace the dead worker,
        // we're not sentimental
        console.log('Worker %d died :(', worker.id);
        cluster.fork();

    });
} else {


}

var pool = mysql.createPool({
    connectionLimit: 20,
    host: '46.29.165.157',
    user: 'mmania.org_st',
    password: 'Vadalma',
    database: 'mmania.org_story'
});

app.get('/createDB', (req, res) => {
    let sql = 'CREATE DATABASE filmes';
    pool.query(sql, (err, result) => {
        if (err) throw err;

        console.log(result);
        res.send('Database created');
    });
});

app.get('/open/:link', (req, res) => {

    let decLink = Buffer.from(req.params.link, 'base64');
    /*
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader("Access-Control-Allow-Headers", "*");
    */
    res.render('linknezo', {
        decLink
    });
});

app.get('/search', (req, res) => {
    if (!req.query.kategoria || !req.query.item) {
        res.send('Nem jó paraméterek!');
    }
    let item = stripApostrophesAndQuotemarks(req.query.item);
    let kat = req.query.kategoria;

    if (kat == 'film') {
        textSearchQuery('movie', 'title', 'original_title', item, function (error, results, fields) {
            if (error) res.send(error);

            if (results.length == 0) {
                res.send('Sajnos nem találtunk a keresésnek megfelelő filmet.');
            } else {
                renderBuilder(results, 'film', res);
            }
        });
    } else if (kat == 'sorozat') {
        textSearchQuery('series', 'title', 'original_title', item, function (error, results, fields) {
            if (error) res.send(error);

            if (results.length == 0) {
                res.send('Sajnos nem találtunk a keresésnek megfelelő sorozatot ');
            } else {
                renderBuilder(results, 'sorozat', res);
            }
        });
    } else {
        res.send('Nem ismert kategóriát küldtél, kérlek válassz a legördülő listában lévő lehetőségek valamelyikéből!')
    }
});

function renderBuilder(dbElem, tipus, res) {
    let responsePayload = {
        results: dbElem
    };
    res.render('talalatok', {
        responsePayload: responsePayload
    });
}

function stripApostrophesAndQuotemarks(text) {
    let strippedText = text.replace("'", "");
    return strippedText.replace("\"", "");
}

function textSearchQuery(tableName, colName, secColName, varName, callback) {
    let sql = 'SELECT * FROM ' + tableName + ' WHERE ' + colName + ' LIKE \'%' + varName + '%\'';
    let sql2 = 'SELECT * FROM ' + tableName + ' WHERE ' + secColName + ' LIKE \'%' + varName + '%\'';
    console.log(sql);
    pool.query(sql, function (error, results, fields) {
        if (error) callback(error, null, null);

        //if we find a result in the first query then we are going to send those results, if not then we try the second query and send those' results
        if (results && results.length == 0) {
            pool.query(sql2, function (error, results, fields) {
                if (error) callback(error, null, null);

                if (results) callback(null, results, fields);
            });
        } else {
            if (results && results.length != 0) callback(null, results, fields);
        }
    });
}

app.get('/oldal/:oldalSzam', (req, res) => {
    // Változók
    var numRows;
    var queryPagination;
    var numPerPage = 16 || 1;
    var page = parseInt(req.params.oldalSzam, 10) || 0;
    console.log(numPerPage);
    console.log(page);
    var numPages;
    var skip = page * numPerPage;
    var skip2 = numPerPage;
    var limit = skip + ', ' + skip2;
    console.log('limit: ');
    console.log(limit);

    let sql_all = 'SELECT sum(rows) as numRows FROM ((SELECT count(*) as rows FROM movie) UNION ALL (SELECT count(*) as rows FROM series)) as u';
    pool.query(sql_all, function (error, results, fields) {
        if (error) throw error;

        numRows = results[0].numRows;
        numPages = Math.ceil(numRows / numPerPage);
        sql1 = 'SELECT * FROM ((SELECT * FROM movie ORDER BY fetched_date DESC LIMIT ' + limit +
            ') UNION ALL (SELECT * FROM series ORDER BY fetched_date DESC LIMIT ' + limit +
            ')) as c ORDER BY c.fetched_date DESC LIMIT 0, ' + numPerPage;
        sql2 = 'SELECT * FROM movie ORDER BY fetched_date DESC LIMIT ' + limit;
        pool.query(sql1,
            function (error, results, fields) {
                if (error) throw error;

                var responsePayload = {
                    results: results
                };
                if (page < numPages) {
                    responsePayload.pagination = {
                        current: page,
                        perPage: numPerPage,
                        previous: page > 0 ? page - 1 : undefined,
                        next: page < numPages - 1 ? page + 1 : undefined
                    }
                }
                else responsePayload.pagination = {
                    err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
                };
                try {
                    console.log(responsePayload);
                    console.log(numPages);
                    console.log(page);

                    res.render('index2', {
                        responsePayload: responsePayload,
                        numOfPages: numPages,
                        currPage: page
                    });
                } catch (err) {
                    res.send(err);
                }
            });
    });
});

app.get('/', (req, res) => {
    req.url = '/oldal/0';
    return app._router.handle(req, res);
});

app.get('/online-sorozatok/:oldalSzam', (req, res) => {
    var numRows;
    var queryPagination;
    var numPerPage = 16 || 1;
    var page = parseInt(req.params.oldalSzam, 10) || 0;
    console.log(numPerPage);
    console.log(page);
    var numPages;
    var skip = page * numPerPage;
    var skip2 = numPerPage;
    var limit = skip + ', ' + skip2;
    console.log('limit: ');
    console.log(limit);
    pool.query('SELECT count(*) as numRows FROM series', function (error, results, fields) {
        if (error) throw error;

        numRows = results[0].numRows;
        numPages = Math.ceil(numRows / numPerPage);
        sql2 = 'SELECT * FROM series ORDER BY fetched_date DESC LIMIT ' + limit;
        pool.query(sql2,
            function (error, results, fields) {
                if (error) throw error;

                var responsePayload = {
                    results: results
                };
                if (page < numPages) {
                    responsePayload.pagination = {
                        current: page,
                        perPage: numPerPage,
                        previous: page > 0 ? page - 1 : undefined,
                        next: page < numPages - 1 ? page + 1 : undefined
                    }
                }
                else responsePayload.pagination = {
                    err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
                };
                try {
                    console.log(responsePayload);
                    console.log(numPages);
                    console.log(page);

                    res.render('online-sorozatok', {
                        responsePayload: responsePayload,
                        numOfPages: numPages,
                        currPage: page
                    });
                } catch (err) {
                    res.send(err);
                }
            });
    });

});

app.get('/nyilatkozat', (req, res) => {
    res.render('nyilatkozat');
});

app.get('/online-filmek/:oldalSzam', (req, res) => {
    var numRows;
    var queryPagination;
    var numPerPage = 16 || 1;
    var page = parseInt(req.params.oldalSzam, 10) || 0;
    console.log(numPerPage);
    console.log(page);
    var numPages;
    var skip = page * numPerPage;
    var skip2 = numPerPage;
    var limit = skip + ', ' + skip2;
    console.log('limit: ');
    console.log(limit);
    pool.query('SELECT count(*) as numRows FROM movie', function (error, results, fields) {
        if (error) throw error;

        numRows = results[0].numRows;
        numPages = Math.ceil(numRows / numPerPage);
        sql2 = 'SELECT * FROM movie ORDER BY fetched_date DESC LIMIT ' + limit;
        pool.query(sql2,
            function (error, results, fields) {
                if (error) throw error;

                var responsePayload = {
                    results: results
                };
                if (page < numPages) {
                    responsePayload.pagination = {
                        current: page,
                        perPage: numPerPage,
                        previous: page > 0 ? page - 1 : undefined,
                        next: page < numPages - 1 ? page + 1 : undefined
                    }
                }
                else responsePayload.pagination = {
                    err: 'queried page ' + page + ' is >= to maximum page number ' + numPages
                };
                try {
                    console.log(responsePayload);
                    console.log(numPages);
                    console.log(page);

                    res.render('online-filmek', {
                        responsePayload: responsePayload,
                        numOfPages: numPages,
                        currPage: page
                    });
                } catch (err) {
                    res.send(err);
                }
            });
    });

});

app.get('/littlegreen', (req, res) => {
    res.writeHead(301,
        {Location: 'https://www.google.com'}
    );
    res.end();
});

app.get('/sorozatok/sorozat/:cim', (req, res) => {
    let responsePayload = {
        sql_dir_res: null,
        sql_act_res: null,
        sql_kat_res: null,
        sql_linkek: null
    };
    var title_url = req.params.cim;
    console.log(req.params.cim);

    let id_SQL = 'SELECT * FROM series WHERE new_url = ' + "'" + title_url + "'";
    pool.query(id_SQL, (err, result, fields) => {
        if (err) res.send(err);

        let id;
        (result.length > 0) ? id = result[0].id : res.send("A film amit keresel nem létezik!");

        let p1 = new Promise(function (resolve, reject) {
            let sql_director = 'SELECT f.new_url, f.description, f.title, f.imdb_score, f.img_url, f.yt_trailer_url, f.title, f.original_title, f.fetched_date,' +
                ' f.play_time, f.imdb_url, d.name FROM series f ' + 'INNER JOIN director_series_mt dmmt ON f.id = dmmt.series_id' +
                ' INNER JOIN director d ON dmmt.director_id = d.id' + ' WHERE f.id = ' + "'" + id + "'";

            pool.query(sql_director, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_dir_res = [];
                    result.forEach((key, value) => {
                        sql_dir_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_dir_res);
                }
            });
        });

        let p2 = new Promise(function (resolve, reject) {
            let sql_actor = 'SELECT a.name FROM actor a INNER JOIN actor_series_mt ammt ON a.id = ammt.actor_id' +
                ' INNER JOIN series m ON m.id = ammt.series_id WHERE m.id = ' + "'" + id + "'";

            pool.query(sql_actor, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_act_res = [];
                    result.forEach((key, value) => {
                        sql_act_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_act_res);
                }
            });
        });

        let p3 = new Promise(function (resolve, reject) {
            let sql_kategoria = 'SELECT k.name FROM kategoria k INNER JOIN kategoria_series_mt kmmt ON k.id = kmmt.kategoria_id' +
                ' INNER JOIN series m ON m.id = kmmt.series_id WHERE m.id = ' + "'" + id + "'";

            pool.query(sql_kategoria, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_kat_res = [];
                    result.forEach((key, value) => {
                        sql_kat_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_kat_res);
                }
            });
        });

        let p4 = new Promise(function (resolve, reject) {
            let sql_linkek_query = 'SELECT s.*, lk.*, m.title AS epizod_cim FROM link_collection lk INNER JOIN series_episode m ON m.id = lk.series_episodes_id' +
                ' INNER JOIN series s ON m.series_id = s.id WHERE s.id = ' + "'" + id + "'";

            pool.query(sql_linkek_query, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_linkek = [];
                    result.forEach((key, value) => {
                        sql_linkek.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_linkek);
                }
            });
        });

        Promise.all([p1, p2, p3, p4]).then(function (values) {
            console.log('elso: ');
            let lofasz = [];
            lofasz = values[1];
            console.log(lofasz);
            console.log(values[1]);

            if (values[0] && values[0].length > 0) {
                if (values[1] && values[1].length > 0) {
                    responsePayload.sql_act_res = values[1];
                }
                if (values[2] && values[2].length > 0) {
                    responsePayload.sql_kat_res = values[2];
                }
                if (values[3] && values[3].length > 0) {
                    console.log('HAPPENED');
                    console.log(values[3]);
                    responsePayload.sql_linkek = values[3];
                }

                res.render('sorozat', {
                    asd: 'cicc',
                    title: values[0][0].title,
                    movie_url: values[0][0].new_url,
                    description: values[0][0].description,
                    imdb_score: values[0][0].imdb_score,
                    image_url: values[0][0].img_url,
                    trailer_url: values[0][0].yt_trailer_url,
                    original_title: values[0][0].original_title,
                    fetched_date: values[0][0].fetched_date,
                    play_time: values[0][0].play_time,
                    imdb_url: values[0][0].imdb_ur,
                    dir_name: values[0][0].name,
                    responsePayload: responsePayload
                });
            } else {
                res.send('A film amit keresel sajnos nem létezik a rendszerünkben! :\'(');
            }
        }).catch(function (error) {
            console.log(error);
        });
    });
});

app.get('/filmek/film/:cim', (req, res) => {
    let responsePayload = {
        sql_dir_res: null,
        sql_act_res: null,
        sql_kat_res: null,
        sql_linkek: null
    };
    var title_url = req.params.cim;
    console.log(req.params.cim);

    let id_SQL = 'SELECT * FROM movie WHERE new_url = ' + "'" + title_url + "'";
    pool.query(id_SQL, (err, result, fields) => {
        if (err) res.send(err);

        let id;
        (result.length > 0) ? id = result[0].id : res.send("A film amit keresel nem létezik!");

        let p1 = new Promise(function (resolve, reject) {
            let sql_director = 'SELECT f.new_url, f.description, f.title, f.imdb_score, f.img_url, f.yt_trailer_url, f.title, f.original_title, f.fetched_date,' +
                ' f.play_time, f.imdb_url, d.name FROM movie f ' + 'INNER JOIN director_movie_mt dmmt ON f.id = dmmt.movie_id' +
                ' INNER JOIN director d ON dmmt.director_id = d.id' + ' WHERE f.id = ' + "'" + id + "'";

            pool.query(sql_director, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_dir_res = [];
                    result.forEach((key, value) => {
                        sql_dir_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_dir_res);
                }
            });
        });

        let p2 = new Promise(function (resolve, reject) {
            let sql_actor = 'SELECT a.name FROM actor a INNER JOIN actor_movie_mt ammt ON a.id = ammt.actor_id' +
                ' INNER JOIN movie m ON m.id = ammt.movie_id WHERE m.id = ' + "'" + id + "'";

            pool.query(sql_actor, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_act_res = [];
                    result.forEach((key, value) => {
                        sql_act_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_act_res);
                }
            });
        });

        let p3 = new Promise(function (resolve, reject) {
            let sql_kategoria = 'SELECT k.name FROM kategoria k INNER JOIN kategoria_movie_mt kmmt ON k.id = kmmt.kategoria_id' +
                ' INNER JOIN movie m ON m.id = kmmt.movie_id WHERE m.id = ' + "'" + id + "'";

            pool.query(sql_kategoria, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_kat_res = [];
                    result.forEach((key, value) => {
                        sql_kat_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_kat_res);
                }
            });
        });

        let p4 = new Promise(function (resolve, reject) {
            let sql_linkek_query = 'SELECT * FROM link_collection lk INNER JOIN movie m ON m.id = lk.movie_id WHERE m.id = ' + "'" + id + "'";

            pool.query(sql_linkek_query, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_linkek = [];
                    result.forEach((key, value) => {
                        sql_linkek.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_linkek);
                }
            });
        });

        Promise.all([p1, p2, p3, p4]).then(function (values) {
            console.log('elso: ');
            let lofasz = [];
            lofasz = values[1];
            console.log(lofasz);
            console.log(values[1]);

            if (values[0] && values[0].length > 0) {
                if (values[1] && values[1].length > 0) {
                    responsePayload.sql_act_res = values[1];
                }
                if (values[2] && values[2].length > 0) {
                    responsePayload.sql_kat_res = values[2];
                }
                if (values[3] && values[3].length > 0) {
                    responsePayload.sql_linkek = values[3];
                }

                res.render('movie', {
                    asd: 'cicc',
                    title: values[0][0].title,
                    movie_url: values[0][0].new_url,
                    description: values[0][0].description,
                    imdb_score: values[0][0].imdb_score,
                    image_url: values[0][0].img_url,
                    trailer_url: values[0][0].yt_trailer_url,
                    original_title: values[0][0].original_title,
                    fetched_date: values[0][0].fetched_date,
                    play_time: values[0][0].play_time,
                    imdb_url: values[0][0].imdb_ur,
                    dir_name: values[0][0].name,
                    responsePayload: responsePayload
                });
            } else {
                res.send('A film amit keresel sajnos nem létezik a rendszerünkben! :\'(');
            }
        }).catch(function (error) {
            console.log(error);
        });
    });
    /*
        //TODO: Itt baszottul meg kéne csinálni, hogy egyszer kikeresem a movieID-t, és utána arra keresek rá, mert ez a kurva stringerekesés agyfasz :=(
        let p1 = new Promise(function (resolve, reject) {
            let sql_director = 'SELECT f.new_url, f.description, f.title, f.imdb_score, f.img_url, f.yt_trailer_url, f.title, f.original_title, f.fetched_date,' +
                ' f.play_time, f.imdb_url, d.name FROM movie f ' + 'INNER JOIN director_movie_mt dmmt ON f.id = dmmt.movie_id' +
                ' INNER JOIN director d ON dmmt.director_id = d.id' + ' WHERE f.new_url = ' + "'" + title_url + "'";

            pool.query(sql_director, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_dir_res = [];
                    result.forEach((key, value) => {
                        sql_dir_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_dir_res);
                }
            });
        });

        let p2 = new Promise(function (resolve, reject) {
            let sql_actor = 'SELECT a.name FROM actor a INNER JOIN actor_movie_mt ammt ON a.id = ammt.actor_id' +
                ' INNER JOIN movie m ON m.id = ammt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";

            pool.query(sql_actor, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_act_res = [];
                    result.forEach((key, value) => {
                        sql_act_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_act_res);
                }
            });
        });

        let p3 = new Promise(function (resolve, reject) {
            let sql_kategoria = 'SELECT k.name FROM kategoria k INNER JOIN kategoria_movie_mt kmmt ON k.id = kmmt.kategoria_id' +
                ' INNER JOIN movie m ON m.id = kmmt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";

            pool.query(sql_kategoria, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_kat_res = [];
                    result.forEach((key, value) => {
                        sql_kat_res.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_kat_res);
                }
            });
        });

        let p4 = new Promise(function (resolve, reject) {
            let sql_linkek_query = 'SELECT * FROM link_collection lk INNER JOIN movie m ON m.id = lk.movie_id WHERE m.new_url = ' + "'" + title_url + "'";

            pool.query(sql_linkek_query, (err, result, fields) => {
                if (err) {
                    reject(err);
                } else {
                    let sql_linkek = [];
                    result.forEach((key, value) => {
                        sql_linkek.push(key);
                    });
                    //responsePayload.sql_linkek = sql_linkek_temp;
                    resolve(sql_linkek);
                }
            });
        });

        Promise.all([p1, p2, p3, p4]).then(function (values) {
            console.log('elso: ');
            let lofasz = [];
            lofasz = values[1];
            console.log(lofasz);
            console.log(values[1]);

            if (values[0] && values[0].length > 0) {
                if (values[1] && values[1].length > 0) {
                    responsePayload.sql_act_res = values[1];
                }
                if (values[2] && values[2].length > 0) {
                    responsePayload.sql_kat_res = values[2];
                }
                if (values[3] && values[3].length > 0) {
                    responsePayload.sql_linkek = values[3];
                }

                res.render('movie', {
                    asd: 'cicc',
                    title: values[0][0].title,
                    movie_url: values[0][0].new_url,
                    description: values[0][0].description,
                    imdb_score: values[0][0].imdb_score,
                    image_url: values[0][0].img_url,
                    trailer_url: values[0][0].yt_trailer_url,
                    original_title: values[0][0].original_title,
                    fetched_date: values[0][0].fetched_date,
                    play_time: values[0][0].play_time,
                    imdb_url: values[0][0].imdb_ur,
                    dir_name: values[0][0].name,
                    responsePayload: responsePayload
                });
            } else {
                res.send('A film amit keresel sajnos nem létezik a rendszerünkben! :\'(');
            }
        }).catch(function (error) {
            console.log(error);
        });
        */
    /*
        let sql_director = 'SELECT f.new_url, f.description, f.title, f.imdb_score, f.img_url, f.yt_trailer_url, f.title, f.original_title, f.fetched_date,' +
            ' f.play_time, f.imdb_url, d.name FROM movie f ' + 'INNER JOIN director_movie_mt dmmt ON f.id = dmmt.movie_id' +
            ' INNER JOIN director d ON dmmt.director_id = d.id' + ' WHERE f.new_url = ' + "'" + title_url + "'";
        let sql_actor = 'SELECT a.name FROM actor a INNER JOIN actor_movie_mt ammt ON a.id = ammt.actor_id' +
                ' INNER JOIN movie m ON m.id = ammt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";
        let sql_kategoria = 'SELECT k.name FROM kategoria k INNER JOIN kategoria_movie_mt kmmt ON k.id = kmmt.kategoria_id' +
            ' INNER JOIN movie m ON m.id = kmmt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";
        let sql_linkek = 'SELECT * FROM link_collection lk INNER JOIN movie m ON m.id = lk.movie_id';

        pool.query(sql_linkek, (err, result, fields) => {
            if (err) {
                res.send(JSON.stringify(err));
            } else {
                let sql_linkek_temp = [];
                result.forEach((key, value) => {
                    sql_linkek_temp.push(key);
                });
                responsePayload.sql_linkek = sql_linkek_temp;
            }});
        pool.query(sql_actor, (err, result, fields) => {
            if (err) {
                res.send(JSON.stringify(err));
            } else {
                let sql_act_res_temp = [];
                result.forEach((key, value) => {
                    sql_act_res_temp.push(key['name']);
                });
                responsePayload.sql_act_res = sql_act_res_temp;
            }});
        pool.query(sql_kategoria, (err, result, fields) => {
            if (err) {
                res.send(JSON.stringify(err));
            } else {
                let sql_kat_res_temp = [];
                result.forEach((key, value) => {
                    sql_kat_res_temp.push(key['name']);
                });
                responsePayload.sql_kat_res = sql_kat_res_temp;
            }});
        pool.query(sql_director, (err, result, fields) => {
            if (err) {
                res.send(JSON.stringify(err));
            } else {
                if (result.length > 0) {
                    console.log('RESULTASD: ');
                    console.log(result[0]);
                    res.render('movie', {
                        asd: 'cicc',
                        title: result[0].title,
                        movie_url: result[0].new_url,
                        description: result[0].description,
                        imdb_score: result[0].imdb_score,
                        image_url: result[0].img_url,
                        trailer_url: result[0].yt_trailer_url,
                        original_title: result[0].original_title,
                        fetched_date: result[0].fetched_date,
                        play_time: result[0].play_time,
                        imdb_url: result[0].imdb_ur,
                        dir_name: result[0].name,
                        responsePayload: responsePayload
                    });
                } else {
                    res.send('A film amit kerestél nem létezik az oldalunkon!')
                }
            }
        });
        //res.writeHead(200, {'Content-Type': 'text/html'});
        */
});

app.listen('3000', () => {
    console.log('Server listening on PORT 3000');
});