#!/usr/bin/env node
var execFile  = require('child_process').execFile;
var File      = require('fs');
var Path      = require('path');
var Net       = require('net');


// Dokku root directory
var dokkuRoot = process.argv[2];
if (!dokkuRoot) {
  console.error('Usage: node portmap.js $DOKKU_ROOT\n');
  process.exit(1);
}

// Map public port to container port
var publicToContainer = {};


// Called to create connection with container and pipe to public port.
function connect(socket, containerPort) {
  var destination = Net.createConnection({ port: containerPort });
  destination.on('connect', function() {
    socket.pipe(destination).pipe(socket);
  });
  destination.on('error', function() {
    socket.end();
  });
  socket.on('error', function() {
    destination.end();
  });
}


// Called to start listening on the public port.
function listen(publicPort) {
  var server = Net.createServer();
  server.on('connection', function(socket) {
    var containerPort = publicToContainer[publicPort];
    connect(socket, containerPort);
  });
  // Typically EADDRINUSE
  server.on('error', console.error);
  server.listen(publicPort);
}


// Called to (re-)bind public port to private port.
function bind(publicPort, appName, privatePort) {
  // Need to find the container port associated with that app's private port
  var containerID = File.readFileSync( Path.join(dokkuRoot, appName, 'CONTAINER'), 'utf-8').trim();
  var args        = ['port', containerID, privatePort];
  execFile('docker', args, function(error, stdout, stderr) {
    if (error) {
      console.error(stderr);
    } else {

      if (!publicToContainer[publicPort]) {
        // First time binding public port, start listening
        listen(publicPort);
      }

      // Output of docker port commans looks like: 0.0.0.0:49166
      var containerPort = stdout.trim().split(':')[1];
      publicToContainer[publicPort] = containerPort;
      console.log(publicPort, '->', containerPort, '->', privatePort, 'for', appName);
      
    }
  });
}


// Reload bindings.
function reload() {
  var bindings = File.readFileSync( Path.join(dokkuRoot, 'BIND'), 'utf-8');
  bindings.split(/\n/)
    .filter(function(line) {
      return line.length;
    })
    .map(function(line) {
      var parts = line.split(':');
      if (parts.length === 3) {
        bind(parts[0], parts[1], parts[2]);
      } else
        console.error("Invalid BIND line", line);
    });
}


// Send SIGHUP to the process to reload BIND file and update bindings
process.on('SIGHUP', reload);
// Start
reload();
// Wait forever.  This is required if BIND is empty and we're not listening on
// any port.
setInterval(Function, 5000);

