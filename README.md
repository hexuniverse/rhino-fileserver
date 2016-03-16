rhino-fileserver
=========

Overview
-----------
rhino-fileserver is a HTTP file server written on [Rhino JS].

Features
-----------
  - File listings: name, type, size, owner, modification time.
  - Links to line numbers.
  - Syntax highlighting.
  - z/OS support: data sets, PDS directories, catalog search.

Usage
-----------
```sh
fileserver.js -p<PORT>
```

Screenshots
-----------
File view:
![File view](http://i.imgur.com/konbNk4.png "File view")
File list:
![File list](http://i.imgur.com/MinO4r8.png "File list")
Data set list:
![Data set list](http://i.imgur.com/CiAONEy.png "Data set list")

fileserver.sh script could be used to daemonize a process and kill a daemon by PID found in log:
```sh
fileserver [stop]
```

[Rhino JS]:https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Rhino