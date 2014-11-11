rhino-fileserver
=========

rhino-fileserver is the HTTP file server written on [Rhino JS].

Features:
  - File listings: name, type, size, owner, modification time.
  - Links to line numbers.
  - Syntax highlighting.
  - z/OS support: data sets, PDS directories, catalog search.

Usage:
```sh
fileserver.js -p<PORT>
```

fileserver.sh script could be used to daemonize a process and kill a daemon by PID found in log:
```sh
fileserver [stop]
```

[Rhino JS]:https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Rhino