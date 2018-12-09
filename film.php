<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

function convertToHoursMins($time, $format = '%02d:%02d')
{
    if ($time < 1) {
        return;
    }
    $hours = floor($time / 60);
    $minutes = ($time % 60);
    return sprintf($format, $hours, $minutes);
}

?>

<?php
require_once('simple_html_dom.php');
$servername = "46.29.165.157";
$username = "mmania.org_st";
$password = "Vadalma";
$database = 'mmania.org_story';

// Create connection
$conn = new mysqli($servername, $username, $password, $database);
// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully";
mysqli_set_charset($conn, "utf8");


function getHTMLContent($url)
{
    $context = stream_context_create(array(
        'http' => array(
            'header' => array('User-Agent: Mozilla/5.0 (Windows; U; Windows NT 6.1; rv:2.2) Gecko/20110201'),
        ),
    ));

    // Get the latest movie from the main page.
    $html = file_get_html($url, false, $context);
    $datahtml = str_get_html($html);
    return $datahtml;
}

function runCurl($url)
{
    $directory = '/home/mmania.org/web/sztoriklubb.eu/public_html/';
    $dir = $directory . "/nein";
    $cookie = "/home/mmania.org/web/sztoriklubb.eu/public_html/nein/cookies.txt";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie);

    $result = curl_exec($ch);
    return $result;
}

//teszter();

function teszter()
{
    $datahtml = getHTMLContent('http://filmezek.com/online-filmek/kiwi-christmas/');
    $sorozat = null;

    $sorozat = $datahtml->find('button[class=btn btn-info]');
    if ($sorozat == null) {
        // Ilyenkor film van
        addNewMovie('http://filmezek.com/online-filmek/kiwi-christmas/', $datahtml);
    } else {
        // Ilyenkor sorozat van
        addNewSeries();
    }
}

function addNewLinkSet($shows, $j)
{
    $url = $shows[$j]->children(0)->children(0)->children(0)->children(0)->href;

    $sorozat = null;
    //$result = runCurl($url);
    $datahtml = getHTMLContent($url);
    $sorozat = $datahtml->find('button[class=btn btn-info]');
    if ($sorozat == null) {
        // Ilyenkor film van
        addNewMovie($url, $datahtml);
    } else {
        // Ilyenkor sorozat van
        addNewSeries();
    }
}

function addDirectorsAndMovies($mov_id, $rendezo)
{
    $rendezo_exists = "SELECT * FROM director where name='$rendezo'";
    print "rendez_exists";
    print $rendezo_exists;
    $result_2 = $GLOBALS['conn']->query($rendezo_exists);
    print_r(mysqli_num_rows($result_2) > 0);
    if (mysqli_num_rows($result_2) > 0) {
        // director exists, add to mapping table.
        echo "Director already exists, adding a new record for mapping table!";
        $ex_dir_id = null;
        while ($row = mysqli_fetch_array($result_2)) {
            $ex_dir_id = $row['id'];
            break;
        }
        $sql_insert_dir_movie_mt = "INSERT INTO director_movie_mt (movie_id, director_id) VALUES ('$mov_id', '$ex_dir_id')";
        $result_5 = $GLOBALS['conn']->query($sql_insert_dir_movie_mt);
        if ($result_5) {
            echo 'Director Mapping Table beírás sikeres!';
        } else {
            echo 'Director Mapping Table beírás sikertelen!';
        }
    } else {
        // Add new director.
        $sql_insert_rendezo = "INSERT INTO director (name) VALUES ('$rendezo')";
        $result_3 = $GLOBALS['conn']->query($sql_insert_rendezo);
        $sql_get_new_rendezo = "SELECT * FROM director where name='$rendezo'";
        $result_6 = $GLOBALS['conn']->query($sql_get_new_rendezo);
        if (mysqli_num_rows($result_6) > 0) {
            echo 'New Director added to director table!';
            // get the new director id
            $dir_id = null;
            while ($row = mysqli_fetch_array($result_6)) {
                $dir_id = $row['id'];
                break;
            }
            echo "dir_id: ";
            echo $dir_id;
            // beiras sikeres. most jöhet a mapping table beirasa
            $sql_insert_dir_movie_mt = "INSERT INTO director_movie_mt (movie_id, director_id) VALUES ('$mov_id', '$dir_id')";
            $result_4 = $GLOBALS['conn']->query($sql_insert_dir_movie_mt);
            if ($result_4) {
                echo 'Director Mapping Table beírás sikeres!';
            } else {
                echo 'Director Mapping Table beírás sikertelen!';
            }
        } else {
            //failed to add director
            echo "Failed to add new director!";
        }
    }
}

function orbuilder($szineszek)
{
    $szinesz_string = "name='" . $szineszek[0] . "'";
    for ($i = 1; $i < sizeof($szineszek); $i++) {
        $szinesz_string .= " OR name='$szineszek[$i]'";
    }

    echo 'szineszstring: ';
    echo $szinesz_string;

    $talat_szineszek_SQL = "SELECT * FROM actor where $szinesz_string";

    echo "sql: ";
    echo $talat_szineszek_SQL;

    $megtalalt_szineszek = $GLOBALS['conn']->query($talat_szineszek_SQL);
    if ($megtalalt_szineszek) {
        echo ' query was succes';
    } else {
        echo ' quiery was kein succes';
    }
    // new movie record's id.
    $existing_actors = array();
    while ($row = mysqli_fetch_array($megtalalt_szineszek)) {
        array_push($existing_actors, $row['name']);
    }

    // Feltöltjük azokkal a színészekkel a tömböt akik még nincsenek letárolva
    $non_ex_szineszek = array();
    $insert_str = '';
    for ($i = 0; $i < sizeof($szineszek); $i++) {
        if (!in_array($szineszek[$i], $existing_actors)) {
            array_push($non_ex_szineszek, $szineszek[$i]);
            $insert_str .= "('$szineszek[$i]'), ";
        }
    }

    echo "non_ex szineszek tömb: ";
    print_r($non_ex_szineszek);

    return $insert_str;
    /*
    $szineszek_up_SQL = "INSERT INTO actor (name) VALUES $insert_str";
    $szineszek_up_SQL = substr($szineszek_up_SQL, 0, -3) . ')';
    print "QUERY: ";
    print $szineszek_up_SQL;

    $beillesztett_szineszek_res = $GLOBALS['conn']->query($szineszek_up_SQL);

    if ($beillesztett_szineszek_res) {
        echo ' query was succes! ';
    } else {
        echo ' quiery was kein succes! ';
    }
*/
}

function addActorsAndMovies($mov_id, $szineszek)
{
    // Insert in the newly found actors
    $insert_str = orbuilder($szineszek);
    if (strlen($insert_str) > 2) {
        $szineszek_up_SQL = "INSERT INTO actor (name) VALUES $insert_str";
        $szineszek_up_SQL = substr($szineszek_up_SQL, 0, -3) . ')';
        print "QUERY: ";
        print $szineszek_up_SQL;

        $beillesztett_szineszek_res = $GLOBALS['conn']->query($szineszek_up_SQL);

        if ($beillesztett_szineszek_res) {
            echo ' query was succes! ';
        } else {
            echo ' quiery was kein succes! ';
        }
    }
    // Get the ID-s of actors
    $szinesz_string = "name='" . $szineszek[0] . "'";
    for ($i = 1; $i < sizeof($szineszek); $i++) {
        $szinesz_string .= " OR name='$szineszek[$i]'";
    }

    echo 'szineszstring: ';
    echo $szinesz_string;

    $talat_szineszek_SQL = "SELECT * FROM actor where $szinesz_string";
    $megtalalt_szineszek = $GLOBALS['conn']->query($talat_szineszek_SQL);
    if ($megtalalt_szineszek) {
        echo ' query was succes';
    } else {
        echo ' quiery was kein succes';
    }
    // new movie record's id.
    $existing_actors = array();
    while ($row = mysqli_fetch_array($megtalalt_szineszek)) {
        array_push($existing_actors, $row['id']);
    }

    buildMTInsertString($existing_actors, 'actor_movie_mt', $mov_id);
}

function buildMTInsertString($existing_actors, $table, $mov_id) {
    $non_ex_szineszek = array();
    $insert_str = '';
    for ($i = 0; $i < sizeof($existing_actors); $i++) {
        $insert_str .= "('$existing_actors[$i]', '$mov_id'), ";
    }

    // update the mapping table
    $szineszek_up_SQL = "INSERT INTO actor_movie_mt (actor_id, movie_id) VALUES $insert_str";
    $szineszek_up_SQL = substr($szineszek_up_SQL, 0, -3) . ')';
    print "QUERY: ";
    print $szineszek_up_SQL;

    $beillesztett_szineszek_res = $GLOBALS['conn']->query($szineszek_up_SQL);

    if ($beillesztett_szineszek_res) {
        echo ' query was succes! ';
    } else {
        echo ' quiery was kein succes! ';
    }
}

function addNewMovie($url, $datahtml)
{
    // Get the ids for the requests.
    $container = $datahtml->find('div[class=container]', 2);
    $tbody = $container->children(0)->children(1)->children(0)->children(1);
    $trek = $tbody->find('tr');
    $numOfTr = sizeof($trek);
    $linkId = array();
    $tarhelylink = array();
    $nyelvek = array();
    $minoseg = array();
    $datavide = 'data-video_id';
    for ($i = 0; $i < $numOfTr / 2; $i++) {
        $linkId[$i] = $trek[$i * 2]->children(4)->children(0)->$datavide;
        $tarhelylink[$i] = $trek[$i * 2]->children(0)->innertext;
        $nyelvek[$i] = $trek[$i * 2]->children(1)->innertext;
        $minoseg[$i] = $trek[$i * 2]->children(2)->innertext;
    }

    // fetch data to be put into the website
    $hun_title = $datahtml->find('h4[class=media-heading]')[0]->innertext;
    $eng_title = $datahtml->find('h6')[0]->innertext;
    $secondContainer = $datahtml->find('div[class=container]', 1);
    $description = $secondContainer->children(0)->children(1)->children(1)->children(1)->children(4)->innertext;
    echo $description;
    $kat = $secondContainer->children(0)->children(1)->children(1)->children(1)->children(3);
    $linkek = $kat->find('a');
    $kategoriak = array();
    for ($i = 0; $i < sizeof($linkek); $i++) {
        $kategoriak[$i] = $linkek[$i]->innertext;
    }

    $imdb_score_temp = $datahtml->find('i[class=fa fa-imdb]')[0]->innertext;
    $imdb_score = doubleval(substr($imdb_score_temp, 1));
    $imdb_link = $datahtml->find('a[class=movielist]')[0]->href;
    echo $imdb_link;
    $yt_link = $datahtml->find('a[class="venobox"]')[0]->href;

    $jatek_ido = $datahtml->find('div[class=col-md-2]')[1]->children(1)->children(0)->innertext;
    $rendezo = $datahtml->find('div[class=col-md-2]')[2]->children(1)->children(0)->innertext;
    $szineszek1 = $datahtml->find('div[class=col-md-2]')[3]->children(1);
    $szineszek2 = $szineszek1->find('a');
    $szineszek = array();
    for ($i = 0; $i < sizeof($szineszek2); $i++) {
        $szineszek[$i] = $szineszek2[$i]->innertext;
    }
    $new_url = substr_replace($url, 'http://sztoriklubb.eu', 0, 19);

    $sql = "INSERT INTO movie (original_url, new_url, imdb_score, yt_trailer_url, play_time, description, title, original_title, imdb_url)
          VALUES ('$url', '$new_url', '$imdb_score', '$yt_link', '$jatek_ido', '$description', '$hun_title', '$eng_title', '$imdb_link')";
    $result = $GLOBALS['conn']->query($sql);
    if ($result) {
        echo ' query was succes';
    } else {
        echo 'quiery was kein succes';
    }
    // new movie record's id.
    $mov_id = null;
    while ($row = mysqli_fetch_array($result)) {
        $mov_id = $row['id'];
        break;
    }
    // Fill database with the all the info needed
    addDirectorsAndMovies($mov_id, $rendezo);
    addActorsAndMovies($mov_id, $szineszek);

    // Fill the database with the episode links needed
    /**
     *  $tarhelylink[$i] = $trek[$i * 2]->children(0)->innertext;
    $nyelvek[$i] = $trek[$i * 2]->children(1)->innertext;
    $minoseg[$i] = $trek[$i * 2]->children(2)->innertext;
     */
    for ($k = 0; sizeof($linkId); $k++) {
        getAjaxResult($linkId[$k], $mov_id, $tarhelylink[$k], $nyelvek[$k], $minoseg[$k]);
    }
}

function getAjaxResult($linkId, $mov_id, $tarhelyLink, $nyelv, $minoseg) {
    $directory = '/home/mmania.org/web/sztoriklubb.eu/public_html/';
    $dir = $directory . "/nein";
    $cookie = "/home/mmania.org/web/sztoriklubb.eu/public_html/nein/cookies.txt";

    $fields_string = '';
    $url = "http://filmezek.com/ajax/load.php";
    $fields = array(
        'datatype' => urlencode('mv'),
        'videodataid' => urlencode($linkId)
    );
    foreach ($fields as $key => $value) {
        $fields_string .= $key . '=' . $value . '&';
    }
    rtrim($fields_string, '&');

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
    curl_setopt($ch, CURLOPT_POST, count($fields));

    $result = curl_exec($ch);
    $result = substr($result, 1, -1);

    // update the mapping table
    $link_SQL = "INSERT INTO link_collection (link, tarhely, nyelv, minoseg, movie_id)
      VALUES ('$result', '$tarhelyLink', '$nyelv', '$minoseg', '$mov_id')";
    print "QUERY: ";
    print $link_SQL;

    $beillesztett_link = $GLOBALS['conn']->query($link_SQL);

    if ($beillesztett_link) {
        echo ' query was succes! ';
    } else {
        echo ' quiery was kein succes! ';
    }
}

getLatestUpload();

function getLatestUpload()
{
    $pageUpToDate = false;

    $context = stream_context_create(array(
        'http' => array(
            'header' => array('User-Agent: Mozilla/5.0 (Windows; U; Windows NT 6.1; rv:2.2) Gecko/20110201'),
        ),
    ));

    // Get the latest movie from the main page.
    $html = file_get_html('http://filmezek.com/index.php?filmlista=legujabb&limit=50&page=1', false, $context);
    $datahtml = str_get_html($html);
    $filmek = $datahtml->find('div[class=col-lg-2 col-sm-3 col-xs-6]');
    $elso_film = $filmek[0];

    // Get the latest movie data from database.
    $sql = 'SELECT * FROM movie ORDER BY fetched_date DESC LIMIT 1';
    $result = $GLOBALS['conn']->query($sql);
    while ($row = mysqli_fetch_array($result)) {
        $original_url[0] = $row['original_url'];
    }
    echo "elso film linkje a DBből";
    echo $original_url[0];

    // Get the title link from the first link from Main Page.
    $elsoFilmLink_MainPage = $elso_film->children(0)->children(0)->children(0)->children(0)->href;
    echo "elso film linkje a main pageről!";
    echo $elsoFilmLink_MainPage;

    //Compare the two
    if ($original_url[0] == $elsoFilmLink_MainPage) {
  /*
        $pageUpToDate = false;
        $sql2 = 'SELECT * FROM series ORDER BY id DESC LIMIT 1';
        $result2 = $GLOBALS['conn']->query($sql2);
        while ($row2 = mysqli_fetch_array($result2)) {
            $original_ur2l[0] = $row['original_url'];
        }
*/
        //if ($original_ur2l[0] == $elsoFilmLink_MainPage) {
            $pageUpToDate = true;
        //}
    }

    if (!$pageUpToDate) {
        $i = sizeof($filmek);
        $tittel = null;
        $megvan = false;
        for ($j = $i - 1; $j != 0; $j--) {
            $tittel = $filmek[$j]->children(0)->children(0)->children(0)->children(0)->href;
            echo 'tittel';
            echo $tittel;
            if ($megvan == true) {
                addNewLinkSet($filmek, $j);
            }
            if ($megvan == false && $tittel == $elsoFilmLink_MainPage) {
                $megvan = true;
            } else {
                continue;
            }
        }

    }
}

//getLatestUpload();

/*
$directory = '/home/mmania.org/web/sztoriklubb.eu/public_html/';
$dir = $directory . "/nein";
$url = "http://filmezek.com/online-filmek/csaladi-osszeeskuves/";
$cookie = "/home/mmania.org/web/sztoriklubb.eu/public_html/nein/cookies.txt";

$ch = curl_init();
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie);

$result = curl_exec($ch);
//echo $result;
//print_r($result);

$fields_string = '';
$url = "http://filmezek.com/ajax/load.php";
$fields = array(
    'datatype' => urlencode('mv'),
    'videodataid' => urlencode('67210')
);
foreach ($fields as $key => $value) {
    $fields_string .= $key . '=' . $value . '&';
}
rtrim($fields_string, '&');

$ch = curl_init();
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie);
curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
curl_setopt($ch, CURLOPT_POST, count($fields));

$result = curl_exec($ch);
echo $result;
print_r($result);
*/

?>