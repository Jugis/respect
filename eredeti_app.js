const express = require('express');
const mysql = require('mysql');
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
var Promise = require('bluebird');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(express.static(__dirname + '/public'));
app.use(cors());
//app.engine('html', require('ejs').renderFile);

var pool = mysql.createPool({
    connectionPool: 50,
    host: '46.29.165.157',
    user: 'mmania.org_st',
    password: 'Vadalma',
    database: 'mmania.org_story'
});

const connection = mysql.createConnection({
    host: '46.29.165.157',
    user: 'mmania.org_st',
    password: 'Vadalma',
    database: 'mmania.org_story'
});
var queryAsync = Promise.promisify(connection.query.bind(connection));
/*
connection.connect((err) => {
    if (err) {
        console.log(err);
        setTimeout(handleDisconnect, 2000);
    }
});
*/
function handleDisconnect() {
    connection.connect(function(err) {              // The server is either down
        if(err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
                                            // If you're also serving http, display a 503 error.
    connection.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}

handleDisconnect();

app.get('/createDB', (req, res) => {
    let sql = 'CREATE DATABASE filmes';
    connection.query(sql, (err, result) => {
        if (err) throw err;

        console.log(result);
        res.send('Database created');
    });
});

app.get('/open/:link', (req, res) => {
    let decLink = Buffer.from(req.params.link, 'base64');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.render('linknezo', {
        decLink
    });
});

app.get('/oldal/:oldalSzam', (req, res) => {
    // Változók
    var numRows;
    var queryPagination;
    var numPerPage = 20 || 1;
    var page = parseInt(req.params.oldalSzam, 10) || 0;
    console.log(numPerPage);
    console.log(page);
    var numPages;
    var skip = page * numPerPage;
    var skip2 = numPerPage;
    var limit = skip + ', ' + skip2;
    console.log('limit: ');
    console.log(limit);
    queryAsync('SELECT count(*) as numRows FROM movie')
        .then(function (results) {
            numRows = results[0].numRows;
            numPages = Math.ceil(numRows / numPerPage);
            //'SELECT * FROM movie ORDER BY fetched_date DESC LIMIT ' + limit
            /*
            * 'SELECT * FROM (SELECT original_url, new_url, fetched_date, imdb_score, imdb_url, yt_trailer_url, play_time, description, title, original_title, img_url FROM movie AS one ORDER BY fetched_date DESC LIMIT ' + limit +
            ') UNION ALL (SELECT original_url, new_url, fetched_date, imdb_score, imdb_url, yt_trailer_url, play_time, description, title, original_title, img_url FROM series AS two ORDER BY fetched_date DESC LIMIT ' + limit + '))'*/
        })
        .then(() => queryAsync('SELECT * FROM ((SELECT * FROM movie ORDER BY fetched_date DESC LIMIT ' + limit +
            ') UNION ALL (SELECT * FROM series ORDER BY fetched_date DESC LIMIT ' + limit +
            ')) as c ORDER BY c.fetched_date DESC LIMIT ' + limit))
        .then(function (results) {
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
                res.render('index2', {
                    responsePayload: responsePayload,
                    numOfPages: numPages,
                    currPage: page
                });
            } catch (err) {
                res.send(err);
            }

        })
        .catch(function (err) {
            console.error(err);
            res.json({err: err});
        });
    //res.render('index2')
});

app.get('/', (req, res) => {
    req.url = '/oldal/0';
    return app._router.handle(req, res);
});

app.get('/sorozatok/sorozat/:cim', (req, res) => {

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
    let sql_director = 'SELECT f.new_url, f.description, f.title, f.imdb_score, f.img_url, f.yt_trailer_url, f.title, f.original_title, f.fetched_date,' +
        ' f.play_time, f.imdb_url, d.name FROM movie f ' + 'INNER JOIN director_movie_mt dmmt ON f.id = dmmt.movie_id' +
        ' INNER JOIN director d ON dmmt.director_id = d.id' + ' WHERE f.new_url = ' + "'" + title_url + "'";
    let sql_actor = 'SELECT a.name FROM actor a INNER JOIN actor_movie_mt ammt ON a.id = ammt.actor_id' +
        ' INNER JOIN movie m ON m.id = ammt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";
    let sql_kategoria = 'SELECT k.name FROM kategoria k INNER JOIN kategoria_movie_mt kmmt ON k.id = kmmt.kategoria_id' +
        ' INNER JOIN movie m ON m.id = kmmt.movie_id WHERE m.new_url = ' + "'" + title_url + "'";
    let sql_linkek = 'SELECT * FROM link_collection lk INNER JOIN movie m ON m.id = lk.movie_id';

    connection.query(sql_linkek, (err, result, fields) => {
        if (err) {
            res.send(JSON.stringify(err));
        } else {
            let sql_linkek_temp = [];
            result.forEach((key, value) => {
                sql_linkek_temp.push(key);
            });
            responsePayload.sql_linkek = sql_linkek_temp;
        }});
    connection.query(sql_actor, (err, result, fields) => {
        if (err) {
            res.send(JSON.stringify(err));
        } else {
            let sql_act_res_temp = [];
            result.forEach((key, value) => {
                sql_act_res_temp.push(key['name']);
            });
            responsePayload.sql_act_res = sql_act_res_temp;
        }});
    connection.query(sql_kategoria, (err, result, fields) => {
        if (err) {
            res.send(JSON.stringify(err));
        } else {
            let sql_kat_res_temp = [];
            result.forEach((key, value) => {
                sql_kat_res_temp.push(key['name']);
            });
            responsePayload.sql_kat_res = sql_kat_res_temp;
        }});
    connection.query(sql_director, (err, result, fields) => {
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
});

app.listen('3000', () => {
    console.log('Server listening on PORT 3000');
});