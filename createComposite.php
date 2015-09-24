<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);



if(!isset($_GET['uri']) || $_GET['uri'] == "") {echo "You must pass a URI parameter"; return;}

$uri = isset($_GET['uri']) ? $_GET['uri'] : '';
$strategy = isset($_GET['strategy']) ? $_GET['strategy'] : '';

$sanitizedURI = trim(preg_replace('/[\.\/\-]/','',$uri));
$sanitizedURI = str_replace('www','',$sanitizedURI);
$sanitizedURI = str_replace('http','',$sanitizedURI);

if($strategy != 'all') {
  generateScreenshot($sanitizedURI, $strategy, true);
} else {
  $strategies = array('alSum','interval','temporalInterval','random');
  for($s=0; $s<count($strategies); $s++) {
    generateScreenshot($sanitizedURI, $strategies[$s], false);
  }

  echo "<html><body><h1>All strategies: ".$sanitizedURI."</h1>";

  for($s=0; $s<count($strategies); $s++) {
    echo '<div style="float: left; border: 3px double red; margin: 5px; text-align: center;"><img style="width: 600px;" src="./composites/'.$strategies[$s].'_'.$sanitizedURI.'_composite.png" /><br />'.$strategies[$s].'</div>';
  }
}

function generateScreenshot($uri, $strategy, $httpForward=true) {

  $files = glob('./screenshots/'.$strategy.'_*'.$uri.'_200.png');
  if(count($files) == 0) {
    echo "Composite not generated for this URI due to lack of files or bad strategy name. Try alSum, temporalInterval, interval, or random";
    return;
  }


  $mod = floor(count($files)/16);
  $str = '';
  $cmd = 'montage ';

  $imageCount = 0;
  $selectedImages = array();

  // For URIs that have fewer than 16 thumbnails
  if($mod < 1) { $mod = 1;}



  for($f=0; $f<count($files); $f++) {
    if($f % $mod == 0){
      array_push($selectedImages,'./'.$files[$f]);
      ++$imageCount;
      if($imageCount >= 16) {break;}
    }
  }


  $im = new Imagick($selectedImages);
  $res = $im->montageImage(new ImagickDraw(), '4x4', '200x150+1+1', imagick::MONTAGEMODE_UNFRAME, "1x1+2+2");
  $res->setImageFormat('png');

  $outputFile = './composites/'.$strategy.'_'.$uri.'_composite.png';
  $res->writeImage($outputFile);
  if($httpForward) {header('Location: '.$outputFile);}
}

?>
