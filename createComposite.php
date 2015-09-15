<?php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(-1);

if(!isset($_GET['uri']) || $_GET['uri'] == "") {echo "You must pass a URI parameter"; return;}

$uri = $_GET['uri'];
$sanitizedURI = trim(preg_replace('/[\.\/\-]/','',$uri));

$files = glob('./screenshots/*'.$sanitizedURI.'_200.png');
if(count($files) == 0) {
  echo "Composite not generated for this URI due to lack of files.";
  return;
}

$mod = floor(count($files)/16);
$str = '';
$cmd = 'montage ';
$fileStr = '';

$imageCount = 0;
$selectedImages = array();


for($f=0; $f<count($files); $f++) {
  $str .= "<span";
  if($f % $mod != 0){
    $str .= ' style="color: #ccc;"';
    $fileStr .= $files[$f].' ';
    array_push($selectedImages,'./'.$files[$f]);
    if(++$imageCount >= 16) {break;}
  }
  $str .= ">".$files[$f]."</span><br />";
}

$im = new Imagick($selectedImages);
$res = $im->montageImage(new ImagickDraw(), '4x4', '200x150', '0', '0');
$res->setImageFormat('png');

$outputFile = './composites/'.$sanitizedURI.'_composite.png';
$res->writeImage($outputFile);
header('Location: '.$outputFile);

?>
