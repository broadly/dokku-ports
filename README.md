This Dokku plugin allows you to connect additional application ports (TCP only).


### Quick Start

Use this for protocols other than HTTP/S that you want to use with zero
downtime.

In your application's root directory, create a file called `PORTS` that lists
the public port you want to support, and the private port your application is
listening on.

For example, if you want to support SMTP and IMPA (ports 25 and 143
respectively), and your application is listening on ports 5025 and 5143, your
`PORTS` file will read:

```
25:5025
143:5143
```

After deploy, the plugin will listen on the public ports listed on the left, and
send requests to the private ports listed on the right.  Make sure to open the
firewall to allow access to the public ports.


### Details

Docker allows you to listen on any public port, including privileged port.
However, only one container can listen on a given public port, and for zero
downtime deploys you need to run two containers side by side.

For HTTP/S, Dokku handles this by letting Docker pick a random port to listen
on, and in the post-deploy phase, updates the Nginx configuration with the
random port assigned to the new container.

It then tells Nginx to reload the configuration, sending new requests to the new
container, while existing requests are handled by the old container.

This plugin works on the same principle.  It runs a service called `dokku-ports`
that, like Nginx, routes traffic between a public port and the Docker random
port.  Docker takes it the rest of the way, routing to the application's private
port.

The plugin reads its configuration by loading each application's `PORTS` file,
where it finds the public port to listen on, and the private application port.
It then asks Docker for the recent container port associated with that private
port (you can see for yourself by running `docker ps` or `docker port`).

Each deploy sends a `SIGHUP` to the service, causing it to reload all `PORTS`
files.  It then updates the outbound ports, so new connections will route to
Docker port of the newly deployed container, while exsiting connections are
still routing to the Docker port of the older container.

