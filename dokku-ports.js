#!/usr/bin/env node
// Reads PORTS file for each application, binds public ports to container ports.
//
// Runs as a service.  After deploy, send SIGHUP to reload all PORTS files.
var execFile  = require('child_process').execFile;
var File      = require('fs');
var Path      = require('path');
var Net       = require('net');


// Dokku root directory
var dokkuRoot = process.argv[2];
if (!dokkuRoot) {
  console.error('Usage: node dokku-ports.js $DOKKU_ROOT\n');
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
function bindPorts(publicPort, privatePort, appPath) {
  // Need to find the container port associated with that app's private port
  var containerID = File.readFileSync( Path.join(appPath, 'CONTAINER'), 'utf-8').trim();
  var args        = ['port', containerID, privatePort];
  execFile('docker', args, function(error, stdout, stderr) {
    if (error) {
      console.error(stderr);
      return;
    }

    if (!publicToContainer[publicPort]) {
      // First time binding public port, start listening
      listen(publicPort);
    }

    // Output of docker port commans looks like: 0.0.0.0:49166
    var containerPort = stdout.trim().split(':')[1];
    publicToContainer[publicPort] = containerPort;
    console.log(publicPort, '->', containerPort, '->', privatePort, 'for', Path.basename(appPath));

  });
}


// Reload the given PORTS file.
function reloadPorts(portsFile) {
  File.readFile(portsFile, 'utf-8', function(error, ports) {
    if (error) {
      console.error(error);
      return;
    }
    
    ports.split(/\n/)
      .filter(function(line) {
        return line.length;
      })
      .forEach(function(line) {
        var path  = Path.dirname(portsFile);
        var parts = line.split(':');
        if (parts.length === 2) {
          bindPorts(parts[0], parts[2], path);
        } else
          console.error("Invalid PORTS line", line);
      });
  });
}


// Reload all PORTS files.
function reload() {
  File.readdir(dokkuRoot, function(error, filenames) {
    if (error) {
      console.error(error);
      return;
    }
    
    filenames
      .map(function(app) {
        return Path.join(dokkuRoot, app, 'PORTS');
      })
      .filter(function(filename) {
        return File.existsSync(filename);
      })
      .forEach(reloadPorts);
  });
}


// Send SIGHUP to the process to reload PORTS files and update bindings
process.on('SIGHUP', reload);
// Start
reload();
// Wait forever.  This is required if PORTS are empty and we're not listening on
// any port.
setInterval(Function, 5000);

