ArchiveThumbnails
================

An implementation of Ahmed AlSum's 2014 ECIR paper titled ["Thumbnail Summarization Techniques for Web
Archives"](http://www.cs.odu.edu/~mln/pubs/ecir-2014/ecir-2014.pdf) for the Web Archiving Incentive Program for Columbia University Libraries' grant, "Visualizing Digital Collections of Web Archives".

## Running

To execute the code, run `node AlSummarization.js`.

To query the server instance generated, use `curl -H "Accept-Datetime: Thu, 31 May 2007 20:35:00 GMT" localhost:15421/?URI-R=http://cnn.com` or some parametric variation.
