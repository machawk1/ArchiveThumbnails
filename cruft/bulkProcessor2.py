from time import sleep
import urllib2
from subprocess import call

with open("alexaTopDomains.txt") as f:
    for line in f:
     urir = line.strip()
     serviceURI = "http://localhost:15421/?URI-R="+urir
     call(["curl", serviceURI])
     print serviceURI
     sleep(60)
