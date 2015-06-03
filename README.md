ArchiveThumbnails
================

An implementation of Ahmed AlSum's 2014 ECIR paper titled ["Thumbnail Summarization Techniques for Web
Archives"](http://www.cs.odu.edu/~mln/pubs/ecir-2014/ecir-2014.pdf) for the Web Archiving Incentive Program for Columbia University Libraries' grant, "Visualizing Digital Collections of Web Archives".

## Requirements

[Node.js](https://nodejs.org/) is required to run the service. Once Node is installed, the packages required to use the service can be installed by running `npm install -g` in the root of the project directory. [PhantomJS](http://phantomjs.org/) may also additionally be required depending on your system configuration.

## Running

To execute the code, run `node AlSummarization.js`.

To query the server instance generated using your browser visit `http://localhost:15421/?URI-R=http://matkelly.com`, substituting the URI-R to request a different site's summarization. The additional parameters of `access` and `strategy` can be used to change the summarization process, specifying the means of access and the strategy used for summarization (respectively). `access` can be one of `interface`, `embed`, or `wayback`. `strategy` can be `alSummarization`, `random`, `yearly`, or `skipListed`.

### Example URIs

* `http://localhost:15421/?URI-R=http://matkelly.com`
* `http://localhost:15421/?access=embed&URI-R=http://matkelly.com`
* `http://localhost:15421/?strategy=random&URI-R=http://matkelly.com`
* `http://localhost:15421/?access=wayback&strategy=yearly&URI-R=http://matkelly.com`
* `http://localhost:15421/http://matkelly.com`

## Running as a Docker Container

Running the server in a [Docker](https://www.docker.com/) container can make the process of dependency management easier. The code is shipped with a `Dockerfile` to build a Docker image that will run the service when started. This document assumes that you have Docker setup already, if not then follow the [official guide](https://docs.docker.com/installation/).

### Building Docker Image

Clone the repository and change working directory (if not already) then build the image.

```
$ git clone https://github.com/machawk1/ArchiveThumbnails.git
$ cd ArchiveThumbnails
$ docker build -t archthumb .
```

In the above command `archthumb` is the name of the image which can be anything, but the same needs to be used when running the container instance.

### Running Docker Container (experimental)

Running the container is easy. It exposes port `15421` to the host machine that can be mapped to any other port number (if requred).

```
$ docker run -d -p 15421:15421 nodeapp
```

In the above command the container is running in detached mode and can be accessed from outside on port `15421`. If you want to run the service on a different port, say `80` then change `-p 15421:15421` to `-p 80:15421`.

Container is completely transparent from the outside and it will be accessed as if the service is running in the host machine itself.
