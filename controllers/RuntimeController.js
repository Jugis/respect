module.exports= {
    init : init
};

function init(app){
    app.get('/api/myruntimeroute', function(req,res) {
        res.send({"runtime" : "route"});
    })
};

app.post('/api/dynamic', function(req,res) {
    var dynamicController = require('./controllers/RuntimeController');
    dynamicController.init(app);
    res.status(200).send();
});

