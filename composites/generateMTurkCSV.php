<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);

$baseURI = "http://ws-dl-02.cs.odu.edu/thumbnails/20150924b/";

// Generate Fresh composites
//function generateNewComposites(){
//  global $baseURI;
  $myListURI = $baseURI."screenshots/list_nonZero_min15.php";
  $html = file_get_contents($myListURI);

//$src = "../uris_lulwah_refined.txt";
//$lines = file($src);
$pattern = '/\.\.\/createComposite\.php\?uri\=[a-zA-Z]+\&strategy\=all/';
preg_match_all($pattern, $html, $matches);

$pattern2 = '/\<img src="(.*?)" \/\>/';

$strategies = array('alSum','interval','temporalInterval','random','allTheSame');

$header = "image1src,image2src,image3src,image4src,image5src,image6src,image7src,image8src,";
$header .= "image1strategy,image2strategy,image3strategy,image4strategy,image5strategy,image6strategy,image7strategy,image8strategy".PHP_EOL;

file_put_contents("./test.csv", $header);

$vsInterval = array();
$vsTemporalInterval = array();
$vsRandom = array();
$vsAllTheSame = array();

for($m=0; $m<count($matches[0]); $m++) {
  //echo "Generating ".$matches[0][$m];
  $html2 = file_get_contents($baseURI.substr($matches[0][$m],2));
  preg_match_all($pattern2, $html2, $matches2);
  $imgPaths = $matches2[1];
  echo "Separating out the thumbnails ".$m."/".count($matches[0])."\r\n";
  array_walk($imgPaths, 'relativeToAbsolute');
  //implode(" ", $imgPaths);
  array_push($vsInterval,             array($imgPaths[0],$imgPaths[1],$strategies[0],$strategies[1]));
  array_push($vsTemporalInterval,     array($imgPaths[0],$imgPaths[2],$strategies[0],$strategies[2]));
  array_push($vsRandom,               array($imgPaths[0],$imgPaths[3],$strategies[0],$strategies[3]));
  array_push($vsAllTheSame,           array($imgPaths[0],$imgPaths[4],$strategies[0],$strategies[4]));
  array_push($vsInterval,             array($imgPaths[1],$imgPaths[0],$strategies[1],$strategies[0]));
  array_push($vsTemporalInterval,     array($imgPaths[2],$imgPaths[0],$strategies[2],$strategies[0]));
  array_push($vsRandom,               array($imgPaths[3],$imgPaths[0],$strategies[3],$strategies[0]));
  array_push($vsAllTheSame,           array($imgPaths[4],$imgPaths[0],$strategies[4],$strategies[0]));
}
echo "Shuffling...";
shuffle($vsInterval);
shuffle($vsTemporalInterval);
shuffle($vsRandom);
shuffle($vsAllTheSame);

// Pull one comparison of each sort and randomize to ensure the user sees one of each strategy but in a random order
$processed = 0;
echo "Randomizing each strategy";
$progressCount = count($vsInterval);
while($progressCount >= 0) {
  $testsFromEachStrategy = array();
  array_push($testsFromEachStrategy,array_pop($vsInterval));
  array_push($testsFromEachStrategy,array_pop($vsTemporalInterval));
  array_push($testsFromEachStrategy,array_pop($vsRandom));
  array_push($testsFromEachStrategy,array_pop($vsAllTheSame));
  shuffle($testsFromEachStrategy);
  $newLine = "";
  // Image URIs
  $newLine .= $testsFromEachStrategy[0][0].",".$testsFromEachStrategy[0][1].",".$testsFromEachStrategy[1][0].",".$testsFromEachStrategy[1][1].",";
  $newLine .= $testsFromEachStrategy[2][0].",".$testsFromEachStrategy[2][1].",".$testsFromEachStrategy[3][0].",".$testsFromEachStrategy[3][1].",";
  // Corresponding strategies to above image URIs
  $newLine .= $testsFromEachStrategy[0][2].",".$testsFromEachStrategy[0][3].",".$testsFromEachStrategy[1][2].",".$testsFromEachStrategy[1][3].",";
  $newLine .= $testsFromEachStrategy[2][2].",".$testsFromEachStrategy[2][3].",".$testsFromEachStrategy[3][2].",".$testsFromEachStrategy[3][3].PHP_EOL;

  file_put_contents("./test.csv", $newLine, FILE_APPEND);
  ++$processed;
  echo ($processed)."/".$progressCount."\r\n";

  $progressCount = count($vsInterval);
  if($progressCount == 0) {break;}
  $testsFromEachStrategy = array();
}

echo "CSV written to <a href=\"".$baseURI."composites/test.csv\">".$baseURI."composites/test.csv</a>.";

function relativeToAbsolute(&$item1, $key) {
  global $baseURI;
  $item1 = $baseURI.substr($item1,2);
}

?>
