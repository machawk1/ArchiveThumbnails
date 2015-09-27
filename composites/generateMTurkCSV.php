<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);

// Generate Fresh composites
//http://ws-dl-02.cs.odu.edu/thumbnails/20150924b/createComposite.php?uri=httpthinkbuttoncom&strategy=all

$myListURI = "http://ws-dl-02.cs.odu.edu/thumbnails/20150924b/screenshots/list_nonZero_min15.php";
$html = file_get_contents($myListURI);

// Open Lulwah's URIs file
$src = "../uris_lulwah_refined.txt";
$lines = file($src);
$pattern = '/\.\.\/createComposite\.php\?uri\=[a-zA-Z]+\&strategy\=all/';
preg_match_all($pattern, $html, $matches);

for($m=0; $m<count($matches[0]); $m++) {
  //Foreach URI in the file, create a call to createComposite.php
  echo "Generating ".$matches[0][$m];
  file_get_contents("http://ws-dl-02.cs.odu.edu/thumbnails/20150924b".substr($matches[0][$m],2));
}

?>
