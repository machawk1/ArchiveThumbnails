from time import sleep
import urllib2

with open("alexaTopDomains.txt") as f:
    for line in f:
     urir = line.strip()
     serviceURI = "http://localhost:15421/?strategy=random&URI-R="+urir
     urllib2.urlopen(serviceURI).read()
     print serviceURI
     sleep(60)
     serviceURI = "http://localhost:15421/?strategy=monthly&URI-R="+urir
     urllib2.urlopen(serviceURI).read()
     print serviceURI
     sleep(60)
     serviceURI = "http://localhost:15421/?strategy=skipListed&URI-R="+urir
     urllib2.urlopen(serviceURI).read()
     print serviceURI
     sleep(60)
