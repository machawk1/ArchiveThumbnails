import sys, urllib2, time
from socket import error as SocketError
import errno

iaTM = "http://web.archive.org/web/timemap/link/"

uris = open('lulwah_ijdL_20160225_2170.txt').read().split('\n')
uriCount = len(uris)
for idx,uri in enumerate(uris):
  success = False
  while(not success):
    try:
      f = urllib2.urlopen(iaTM + uri)
      s = f.read()
      time.sleep(10)
      with open("tms/" + uri + '.timemap', "w") as outfile:
        outfile.write(s)
        print str(idx) + "/" + str(uriCount) + ":" + str((100*idx)/uriCount) + "% done - " + uri
        success = True
    except SocketError as e:
      print "Let's try that again."