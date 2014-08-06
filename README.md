This plugin lets you open up additional application ports.

Dokku and its Nginx plugin take care of ports 80 and 443.  Docker allows you to
listen on any public port, but only from one container at a time.  Zero downtime
deploy works by running two containers side by side.

This plugin runs a service called `portmap` that connects public ports to
private ports, based on the contents of the `PORTMAP` file.  The `PORTMAP` file
lives in `/home/dokku` and looks something like:

```bash
25:mail:5010
8080:proxy:5020
```

It will accepts requests on port 25, and route them to port 5010 of the `mail`
application.  Likewie, requests on port 8080 route to port 5020 of the `proxy`
application.

This plugin routes incoming requests, but does not open any ports on the
firewall.  You have to do that separately, for example:

```bash
sudo ufw allow in 25/tcp
sudo ufw allow in 8080/tcp
```
