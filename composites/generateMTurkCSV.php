<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);

$baseURI = "http://ws-dl-02.cs.odu.edu/thumbnails/20150924b/";

// Generate Fresh composites
$myListURI = $baseURI."screenshots/list_nonZero_min15.php";
$html = file_get_contents($myListURI);

// Open Lulwah's URIs file
$src = "../uris_lulwah_refined.txt";
$lines = file($src);
$pattern = '/\.\.\/createComposite\.php\?uri\=[a-zA-Z]+\&strategy\=all/';
preg_match_all($pattern, $html, $matches);

$pattern2 = '/\<img src="(.*?)" \/\>/';

$strategies = array('alSum','interval','temporalInterval','random','allTheSame');

$outputStr = "Input.image1src,Input.image2src,Input.image1strategy,Input.image2strategy,Answer.selectedThumbnail,Answer.preferredStrategy\r\n";
for($m=0; $m<count($matches[0]); $m++) {
  //echo "Generating ".$matches[0][$m];
  $html2 = file_get_contents($baseURI.substr($matches[0][$m],2));
  preg_match_all($pattern2, $html2, $matches2);
  $imgPaths = $matches2[1];

  array_walk($imgPaths, 'relativeToAbsolute');
  implode(" ", $imgPaths);
  $outputStr .= $imgPaths[0].','.$imgPaths[1].",".$strategies[0].','.$strategies[1]."\r\n";
  $outputStr .= $imgPaths[0].','.$imgPaths[2].",".$strategies[0].','.$strategies[2]."\r\n";
  $outputStr .= $imgPaths[0].','.$imgPaths[3].",".$strategies[0].','.$strategies[3]."\r\n";
  $outputStr .= $imgPaths[0].','.$imgPaths[4].",".$strategies[0].','.$strategies[4]."\r\n";

  //return;
}


file_put_contents('./test.csv',$outputStr);
echo "CSV written";
//file_put_contents ( string $filename , mixed $data [, int $flags = 0 [, resource $context ]]

function relativeToAbsolute(&$item1, $key) {
  global $baseURI;
  $item1 = $baseURI.substr($item1,2);
}

?>
