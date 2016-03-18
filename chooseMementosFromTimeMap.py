# From a TimeMap, choose the mementos that need screenshots generated
import re
import arrow # datetime lib
import random
import sys
import glob

def main():
  tms = glob.glob("./tms/*.timemap")
  
  for tm in tms:  
    with open(tm, 'r') as fh:
      tmStr = fh.read()

      urir = re.findall('<(.*)>; rel="original"', tmStr)
      urims =  re.findall('(http://web.archive.org/web/[0-9]{14}.*)>', tmStr)
      
      if not len(urims): continue

      uris_r = chooseRandomURIMs(urims, 9)
      uris_i = chooseIntervalURIMs(urims, 9)
      uris_ti = chooseTemporalIntervalURIMs(urims,9)
      
      print "\n\n" + urir[0] + " (" + str(len(uris_r)) + " Random, " + str(len(uris_i))+ " Interval, " + str(len(uris_ti)) + " Temporal Interval)"
      print "\nRandom"
      for uri in uris_r:
        print uri
      print "\nInterval"
      for uri in uris_i:
        print uri
      print "\nTemporal Interval"
      for uri in uris_ti:
        print uri
      print "\n\n"

def chooseTemporalIntervalURIMs(urims, c):
  unchosenURIMsDatetime = map(lambda u: getDatetimeFromURI(u), urims)

  chosenURIs = []
  lastYearMonth = -1
  # First choose one per year
  for idx, dt in enumerate(unchosenURIMsDatetime):
    yrmo = dt[0][:6]

    unchosenURIMsDatetime[idx]
    if unchosenURIMsDatetime[idx][0] and yrmo != lastYearMonth:
      lastYearMonth = yrmo
      chosenURIs.append(urims[idx])
      unchosenURIMsDatetime[idx][0] = ''

  # Thin the dates, creating larger temporal gaps until c is reached
  return temporallyThinMementos(chosenURIs, 9)


class AdHocSortingObject:
  def __init__(self, originalIndex, value):
    self.originalIndex = originalIndex
    self.value = value
  
def chooseIntervalURIMs(urims, c):
  retURIMs = []

  for u in xrange(0, len(urims)-1, len(urims)/c):
    retURIMs.append(urims[u])
    if len(retURIMs) >= c: break

  return retURIMs

def chooseRandomURIMs(urims, c):
    #print "Picking random "+str(c)+" from "+str(len(urims))+" URIs"
    randomURIMs = random.sample(urims, c)
    randomURIMs.sort(key=lambda u: getDatetimeFromURI(u))
    return randomURIMs

def getDatetimeFromURI(uri):
  return re.findall('[0-9]{14}', uri)

def temporallyThinMementos(chosenURIs, toCount):
  chosenURIDatetimes = map(lambda u: getDatetimeFromURI(u), chosenURIs)
  timeDeltas = []
  
  # Determine time deltas
  lastVal = -1
  for idx,dt in enumerate(chosenURIDatetimes):
    if idx == 0:
      lastVal = int(dt[0])
      continue
    thisVal = int(dt[0])
    
    delta = thisVal - lastVal
    lastVal = thisVal
    timeDeltas.append(AdHocSortingObject(idx, delta))
  timeDeltas.sort(key=lambda dt: dt.value)
  
  # Remove item with smallest temporal differential
  del chosenURIs[timeDeltas[0].originalIndex]
  
  if len(chosenURIs) <= toCount:
    return chosenURIs

  return temporallyThinMementos(chosenURIs, toCount)
  
  #for obj in timeDeltas:
  #  print str(obj.value)+' '+str(obj.originalIndex)
  #print timeDeltas

if __name__ == "__main__":
    main()