<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);

if(!isset($_GET['uri']) || $_GET['uri'] == "") {echo "You must pass a URI parameter"; return;}

$uri = $_GET['uri'];
$sanitizedURI = trim(preg_replace('/[\.\/\-]/','',$uri));
$sanitizedURI = str_replace('www','',$sanitizedURI);
$sanitizedURI = str_replace('http','',$sanitizedURI);

$files = glob('./screenshots/*'.$sanitizedURI.'_200.png');
if(count($files) == 0) {
  echo "Composite not generated for this URI due to lack of files.";
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
$res = $im->montageImage(new ImagickDraw(), '4x4', '200x150', '0', '0');
$res->setImageFormat('png');

$outputFile = './composites/'.$sanitizedURI.'_composite.png';
$res->writeImage($outputFile);
header('Location: '.$outputFile);

?>
