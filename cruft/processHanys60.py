from time import sleep
import urllib2
from subprocess import call

with open("hanys60.txt") as f:
    for line in f:
     urir = line.strip()
     serviceURI = "http://localhost:15421/?URI-R="+urir
     call(["curl", "--ipv4", serviceURI])
     print serviceURI
     sleep(600)
