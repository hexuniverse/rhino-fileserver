#!/bin/env js

/* 
 * Copyright (C) Vadim Shchukin 2014
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

String.prototype.format = function() {
    return String(java.lang.String.format(this, Array.prototype.slice.call(arguments)));
};

function File(name) {
    this.name = name;
}

File.prototype.getPermissions = function() {
    var array = ['-', '-', '-', '-', '-', '-', '-', '-', '-'];
    var Permission = java.nio.file.attribute.PosixFilePermission;
    var set = java.nio.file.Files.getPosixFilePermissions(java.nio.file.Paths.get(this.name));
    for (var iterator = set.iterator(); iterator.hasNext();) {
        var permission = iterator.next();
        switch (permission) {
            case Permission.OWNER_READ:     array[0] = 'r'; break;
            case Permission.OWNER_WRITE:    array[1] = 'w'; break;
            case Permission.OWNER_EXECUTE:  array[2] = 'x'; break;
            case Permission.GROUP_READ:     array[3] = 'r'; break;
            case Permission.GROUP_WRITE:    array[4] = 'w'; break;
            case Permission.GROUP_EXECUTE:  array[5] = 'x'; break;
            case Permission.OTHERS_READ:    array[6] = 'r'; break;
            case Permission.OTHERS_WRITE:   array[7] = 'w'; break;
            case Permission.OTHERS_EXECUTE: array[8] = 'x'; break;
        }
    }
    return array.join('');
};

function Process() {
}

Process.getIdentifier = function() {
    var virtualMachineName = String(java.lang.management.ManagementFactory.getRuntimeMXBean().getName());
    return parseInt(virtualMachineName.match(/^\d+/));
};

function HTTP() {    
}

HTTP.parseQuery = function(query) {
    var parameters = {};
    String(query).split('&').forEach(function(parameter) {
        var array = parameter.split('=');
        var value = array.pop();
        var name = array.pop();
        parameters[name] = value;
    });
    return parameters;
};

HTTP.escapeHTML = function(string) {
    return String(string).replace(/[&<>"'\/]/g, function(character) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": '&#39;',
            "/": '&#x2F;'
        }[character];
    });
};

function Application() {
}

Application.prototype.validateFile = function(exchange) {
    var result = true;
    var requestURI = exchange.getRequestURI();
    var requestPath = new java.io.File(requestURI.getPath()).getCanonicalPath();
    var dataSetName = HTTP.parseQuery(requestURI.getQuery()).d;
    if (dataSetName) {
        try {
            new com.ibm.jzos.ZFile("//'%s'".format(dataSetName), 'rb,type=record,noseek');
        } catch (error if error.javaException instanceof com.ibm.jzos.ZFileException) {
            return false;
        }
        return true;
    }
    if (requestPath.match(new RegExp('^/u/[^/]+/\\.'))) {
        return false;
    }
    var targetFile = new java.io.File(requestPath);
    if (targetFile.isFile()) {
        try {
            new java.io.BufferedReader(new java.io.FileReader(targetFile));
        } catch (error if error.javaException instanceof java.io.FileNotFoundException) {
            return false;
        }
    } else if (targetFile.isDirectory()) {
        return targetFile.canRead();
    } else {
        return false;
    }
    return true;
};

Application.prototype.makePathAnchors = function(path) {
    var result = '';
    var partURL = '';
    var pathParts = path.split('/');
    pathParts.forEach(function(part, index) {
        var partText = part;
        if (index != pathParts.length - 1) {
            partText += '/';
        }
        if (partURL != '/') {
            partURL += '/';
        }
        partURL += part;
        result += '<a href="%s" class="hoverColor">%s</a>'.format(partURL, partText);
    });
    return result;
}

Application.prototype.makeDataSetAnchors = function(dataSetName) {
    var result = '';
    var match = dataSetName.match(/(.+?)(?:\(([^)]+)\))?$/);
    var baseName = match[1];
    var memberName = match[2];
    var partURL = '';
    var parts = baseName.split('.');
    parts.forEach(function(part, index) {
        var partText = part;
        if (index != parts.length - 1) {
            partText += '.';
        }
        if (partURL) {
            partURL += '.';
        }
        partURL += part;
        var reference;
        if (memberName && index == parts.length - 1) {
            reference = '/?d=' + partURL;
        } else {
            reference = '/?s=%s.**'.format(partURL);
        }
        result += '<a href="%s" class="hoverColor">%s</a>'.format(reference, partText);
    });
    return result;
};

Application.prototype.writeResponse = function(response, exchange) {
    var bytes = response.getBytes('utf-8');
    exchange.sendResponseHeaders(200, bytes.length);
    exchange.getResponseBody().write(bytes);
};

Application.prototype.processResponse = function(exchange) {
    var requestURI = exchange.getRequestURI();
    var requestPath = requestURI.getPath();
    var requestParameters = HTTP.parseQuery(requestURI.getQuery());
    var response = new java.lang.StringBuilder();
    var dataSetName = requestParameters.d;
    var view = requestParameters.v;
    exchange.getResponseHeaders().set('Content-Type', 'text/html');
    if (view == 'plain') {
        if (!this.validateFile(exchange)) {
            throw new Error('file cannot be accessed');
        }
        exchange.getResponseHeaders().set('Content-Type', 'text/plain');
        if (dataSetName) {
            targetFile = new com.ibm.jzos.ZFile("//'%s'".format(dataSetName), 'rb,type=record,noseek');
            var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, targetFile.getLrecl());
            var encoding = com.ibm.jzos.ZUtil.getDefaultPlatformEncoding();
            var count = targetFile.read(buffer);
            for (var index = 1; count >= 0; index++) {
                var record = new java.lang.String(buffer, 0, count, encoding);
                response.append(record);
                count = targetFile.read(buffer);
                if (count >= 0) {
                    response.append(java.lang.System.lineSeparator());
                }
            }
            targetFile.close();
        } else {
            var targetFile = new java.io.File(requestPath);
            var reader = new java.io.BufferedReader(new java.io.FileReader(targetFile));
            var line = reader.readLine();
            while (line) {
                response.append(line);
                line = reader.readLine();
                if (line) {
                    response.append(java.lang.System.lineSeparator());
                }
            }
        }
        this.writeResponse(response.toString(), exchange);
        return;
    }
    response.append('<!doctype html><html><head><meta charset="utf-8">');
    response.append('<link rel="shortcut icon" href="data:image/x-icon;," type="image/x-icon">');
    response.append('<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script></head>');
    response.append('<body style="font-size: 13px; line-height: 16px;">');
    var browserLogic = function() {
        $(document).bind('keydown', function(event) {
            if (event.ctrlKey || event.metaKey) {
                switch (String.fromCharCode(event.which).toLowerCase()) {
                case 'd':
                    event.preventDefault();
                    location = '/?d=' + prompt("Data set name:");
                    break;
                }
            }
        });
    }
    var browserLogic = browserLogic.toString();
    browserLogic = browserLogic.substring(browserLogic.indexOf('{') + 1, browserLogic.lastIndexOf('}'));
    response.append('<script>%s</script>'.format(browserLogic));
    if (dataSetName) {
        dataSetName = dataSetName.toUpperCase();
    }
    var dataSetNotFound = false;
    if (dataSetName && !dataSetName.match(/\([^)]+\)$/)) {
        try {
            com.ibm.jzos.ZFile.locateDSN("'%s'".format(dataSetName));
        } catch (error if error.javaException instanceof com.ibm.jzos.RcException) {
            if (error.javaException.getRc() == 8) {
                dataSetNotFound = true;
            } else {
                throw error;
            }
        }
    }
    var filterKey;
    if (dataSetNotFound) {
        filterKey = dataSetName + '.**';
    } else {
        filterKey = requestParameters.s;
    }
    if (filterKey) {
        filterKey = filterKey.toUpperCase();
        response.append('<style>a, td {font-family: monospace;}');
        response.append('a:hover {color: red;}');
        response.append('td:not(:first-child) {padding-left: 25px;}</style>');
        if (dataSetNotFound) {
            response.append(this.makeDataSetAnchors(dataSetName));
        }
        response.append('<table cellpadding="0" style="border-spacing: 0px;">');
        response.append('<tr style="font-weight: bold;"><td>Name</td><td>Dsorg</td>');
        response.append('<td>Recfm</td><td>Lrecl</td><td>Blksz</td><td>Volume</td></tr>');
        var search = new com.ibm.jzos.CatalogSearch(filterKey, 64000);
        search.addFieldName('ENTNAME');
        search.addFieldName('ENTYPE');
        search.search();
        while (search.hasNext()) {
            var entry = search.next();
            if (!entry.isDatasetEntry()) {
                continue;
            }
            var dataSetName = entry.getField('ENTNAME').getFString().trim();
            var dataSetType = String.fromCharCode(entry.getField('ENTYPE').getChar());
            if (dataSetType != 'A') {
                response.append('<tr><td><a href="/?d=%s">%s</a></td>'.format(
                    dataSetName, dataSetName
                ));
                response.append('<td>VS</td><td></td><td></td><td></td></tr>');
                continue;
            }
            var volumeName = com.ibm.jzos.ZFile.locateDSN("'%s'".format(dataSetName))[0];
            if (volumeName == 'MIGRAT') {
                response.append('<tr><td><a href="/?d=%s">%s</a></td>'.format(
                    dataSetName, dataSetName
                ));
                response.append('<td></td><td></td><td></td><td></td></tr>');
                continue;
            }
            var dataSetBlock = com.ibm.jzos.ZFile.obtainDSN("'%s'".format(dataSetName), volumeName);
            var organization = dataSetBlock.getDS1DSORG();
            if (organization & 0x4000) {
                organization = 'PS';
            } else if (organization & 0x0200) {
                organization = 'PO';
            }
            if (dataSetBlock.getDS1SMSFG() & 0x08) {
                organization += '-E';
            }
            var recordFormatCode = dataSetBlock.getDS1RECFM();
            var recordFormat;
            if ((recordFormatCode & 0xC0) == 0x80) {
                recordFormat = 'F';
            } else if ((recordFormatCode & 0xC0) == 0x40) {
                recordFormat = 'V';
            } else if ((recordFormatCode & 0xC0) == 0xC0) {
                recordFormat = 'U';
            }
            if ((recordFormatCode & 0x10) == 0x10) {
                recordFormat += 'B';
            }
            if ((recordFormatCode & 0x06) == 0x04) {
                recordFormat += 'A';
            }
            response.append('<tr><td><a href="/?d=%s">%s</a></td><td>%s</td>'.format(
                dataSetName, dataSetName, organization
            ));
            response.append('<td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>'.format(
                recordFormat, new java.lang.Integer(dataSetBlock.getDS1LRECL()),
                new java.lang.Integer(dataSetBlock.getDS1BLKL()), volumeName
            ));
        }
        response.append('</table></body></html>');
        this.writeResponse(response.toString(), exchange);
        return;
    }
    if (dataSetName && !dataSetName.match(/\([^)]+\)$/)) {
        var volumeName = com.ibm.jzos.ZFile.locateDSN("'%s'".format(dataSetName))[0];
        var dataSetBlock;
        dataSetBlock = com.ibm.jzos.ZFile.obtainDSN("'%s'".format(dataSetName), volumeName);
        if (dataSetBlock.getDS1DSORG() & 0x0200) {
            var recordFormat = true;
            if ((dataSetBlock.getDS1RECFM() & 0xC0) == 0xC0) {
                recordFormat = undefined;
            }
            response.append('<style>a, td {font-family: monospace;}');
            response.append('a:hover {color: red;}');
            response.append('td:not(:first-child) {padding-left: 25px;}</style>');
            response.append(this.makeDataSetAnchors(dataSetName));
            response.append('<table cellpadding="0" style="border-spacing: 0px;">');
            response.append('<tr style="font-weight: bold;">');
            if (recordFormat) {
                response.append('<td>Name</td><td>Size</td>');
                response.append('<td>Created</td><td>Changed</td><td>ID</td></tr>');
            } else {
                response.append('<td>Name</td><td>Size</td>');
                response.append('<td>TTR</td><td>AC</td><td>RM</td></tr>');
            }
            var creationFormat = new java.text.SimpleDateFormat('yyyy/MM/dd');
            var modificationFormat = new java.text.SimpleDateFormat('yyyy/MM/dd HH:mm:ss');
            var directory = new com.ibm.jzos.PdsDirectory("//'%s'".format(dataSetName));
            for (var iterator = directory.iterator(); iterator.hasNext();) {
                var member = iterator.next();
                if (recordFormat) {
                    var statistics = member.getStatistics();
                    if (statistics) {
                        response.append('<tr><td><a href="/?d=%s">%s</a></td><td>%s</td>'.format(
                            '%s(%s)'.format(dataSetName, member.getName()),
                            member.getName(), new java.lang.Integer(statistics.currentLines))
                        );
                        response.append('<td>%s</td><td>%s</td><td>%s</td></tr>'.format(
                            creationFormat.format(statistics.creationDate),
                            modificationFormat.format(statistics.modificationDate), statistics.userid
                        ));
                    } else {
                        response.append('<tr><td><a href="/?d=%s">%s</a></td><td></td>'.format(
                            '%s(%s)'.format(dataSetName, member.getName()), member.getName()
                        ));
                        response.append('<td></td><td></td><td></td></tr>');
                    }
                } else {
                    var userData = member.getUserData();
                    var size = java.util.Arrays.copyOfRange(userData, 9, 13);
                    size[0] &= 0x0F;
                    var accessControl = java.util.Arrays.copyOfRange(userData, 22, 23);
                    var residencyMode = userData[19];
                    if (residencyMode & 0x10) {
                        residencyMode = 'ANY';
                    } else {
                        residencyMode = '24';
                    }
                    var printHexBinary = javax.xml.bind.DatatypeConverter.printHexBinary;
                    response.append('<tr><td><a href="/?d=%s">%s</a></td><td>%s</td>'.format(
                        '%s(%s)'.format(dataSetName, member.getName()),
                        member.getName(), printHexBinary(size)
                    ));
                    response.append('<td>%s</td><td>%s</td><td>%s</td></tr>'.format(
                        printHexBinary(member.getTTR()),
                        printHexBinary(accessControl), residencyMode
                    ));
                }
            }
            directory.close();
            response.append('</table></body></html>');
            this.writeResponse(response.toString(), exchange);
            return;
        }
    }
    var targetFile;
    if (!dataSetName) {
        targetFile = new java.io.File(requestPath);
    }
    if (!this.validateFile(exchange)) {
        throw new Error('file cannot be accessed');
    }
    response.append('<style>a.hoverColor:hover {color: red;}</style>');
    if (dataSetName || targetFile.isFile()) {
        var link = '//cdnjs.cloudflare.com/ajax/libs/jquery-color/2.1.1/jquery.color.min.js';
        response.append('<script src="%s"></script>'.format(link));
        link = '//cdnjs.cloudflare.com/ajax/libs/highlight.js/8.3/highlight.min.js';
        response.append('<script src="%s"></script>'.format(link));
        response.append('<script>hljs.initHighlightingOnLoad();</script>');
        link = '//cdnjs.cloudflare.com/ajax/libs/highlight.js/8.3/styles/vs.min.css';
        response.append('<link rel="stylesheet" href="%s">'.format(link));
        response.append('<style>a {font-family: monospace;}');
        response.append('td:first-child a {display: block;}');
        response.append('td:first-child a:hover {color: red;}</style>');
        response.append('<div style="overflow: hidden;"><div style="float: left;">');
        response.append(dataSetName ? this.makeDataSetAnchors(dataSetName) : this.makePathAnchors(requestPath));
        response.append('</div><div style="float: right;"><select><option>c</option><option>cpp</option>');
        response.append('<option>sh</option><option>makefile</option>');
        response.append('<option>js</option><option>java</option></select></div>');
        response.append('<div style="float: right; margin-right: 20px;">');
        response.append('<a id="plainTextAnchor" href="?v=plain" class="hoverColor">[plain text]</a></div></div>');
        var browserLogic = function() {
            window.onload = function() {
                var parameters = {};
                window.location.search.substring(1).split('&').forEach(function(parameter) {
                    var array = parameter.split('=');
                    var value = array.pop();
                    var name = array.pop();
                    parameters[name] = value;
                });
                var plainTextAnchor = document.getElementById('plainTextAnchor');
                plainTextAnchor.href = window.location.search ? window.location.search + '&' : '?';
                plainTextAnchor.href += 'v=plain';
                var anchors = document.getElementsByTagName('a');
                var lineCount = parseInt(anchors[anchors.length - 1].name.match(/l(\d+)/)[1]);
                var lineNumbers = document.getElementsByTagName('td')[0];
                for (var index = 1; index <= lineCount; index++) {
                    var anchor = document.createElement('a');
                    anchor.href = '#l' + index;
                    if (parameters.v == 'hex') {
                        var number = index * 32;
                        var string = number.toString(16).toUpperCase();
                        while (string.length < 8) {
                            string = '0' + string;
                        }
                        anchor.innerHTML = string;
                    } else {
                        anchor.innerHTML = index;
                    }
                    lineNumbers.appendChild(anchor);
                }
                var selectBlock = document.getElementsByTagName('select')[0];
                selectBlock.onchange = function() {
                    var codeBlock = document.getElementsByTagName('code')[0];
                    codeBlock.className = this.options[this.selectedIndex].value;
                    hljs.highlightBlock(codeBlock);
                };
                var match = window.location.href.match(/#(l\d+)$/);
                if (match) {
                    var anchor = $('a[name=' + match[1] + ']');
                    anchor.stop();
                    for (var index = 0; index < 3; index++) {
                        anchor.animate({backgroundColor: 'lime'}, 250);
                        anchor.animate({backgroundColor: 'white'}, 250);
                    }
                }
            };
        }
        var browserLogic = browserLogic.toString();
        browserLogic = browserLogic.substring(browserLogic.indexOf('{') + 1, browserLogic.lastIndexOf('}'));
        response.append('<script>%s</script>'.format(browserLogic));
        var codeClass = 'nohighlight';
        response.append('<table cellpadding="0" style="border-spacing: 0px;"><tr>');
        response.append('<td valign="top"></td>');
        response.append('<td valign="top"><pre style="float: left; margin: 0px 5px;">');
        if (dataSetName) {
            var match = dataSetName.match(/(.+?)(?:\(([^)]+)\))?$/);
            var baseName = match[1];
            match = baseName.match(/[^.]+$/);
            if (match) {
                var extension = match[0].toLowerCase();
                if (['cpp', 'hpp', 'c', 'h'].indexOf(extension) != -1) {
                    codeClass = extension;
                }
            }
        } else if (view != 'hex') {
            var match = requestPath.match(/(?:\.(cpp|hpp|c|h|js|sh|java))|([mM]akefile)$/);
            if (match) {
                var extension = match[1];
                codeClass = extension;
            }
        }
        response.append('<code class="%s" style="padding: 0px; display: block;">'.format(codeClass));
        if (dataSetName) {
            targetFile = new com.ibm.jzos.ZFile("//'%s'".format(dataSetName), 'rb,type=record,noseek');
            var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, targetFile.getLrecl());
            var encoding = com.ibm.jzos.ZUtil.getDefaultPlatformEncoding();
            var count = targetFile.read(buffer);
            for (var index = 1; count >= 0; index++) {
                var record = new java.lang.String(buffer, 0, count, encoding);
                response.append('<a name="l%s">%s</a>'.format(
                    new java.lang.Integer(index), HTTP.escapeHTML(record.replaceAll('(\n|\r)', '.'))
                ));
                count = targetFile.read(buffer);
                if (count >= 0) {
                    response.append(java.lang.System.lineSeparator());
                }
            }
            targetFile.close();
        } else {
            if (view == 'hex') {
                var stream = new java.io.FileInputStream(targetFile);
                var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
                var bufferCount = 0;
                var lineIndex = 1;
                while (true) {
                    var byteCount = stream.read(buffer, bufferCount, buffer.length - bufferCount);
                    if (byteCount != -1) {
                        bufferCount += byteCount;
                        if (bufferCount < buffer.length) {
                            continue;
                        }
                    }
                    var line = '';
                    var index;
                    for (index = 0; index < bufferCount; index++) {
                        if (index && index % 32 == 0) {
                            response.append('<a name="l%s">%s</a>'.format(
                                new java.lang.Integer(lineIndex), line
                            ));
                            lineIndex++;
                            if (index < bufferCount - 1) {
                                response.append(java.lang.System.lineSeparator());
                            }
                            line = '';
                        }
                        line += java.lang.String.format('%02X ', new java.lang.Integer(buffer[index] & 0xFF));
                    }
                    if (index % 32) {
                        response.append('<a name="l%s">%s</a>'.format(
                            new java.lang.Integer(lineIndex), line
                        ));
                        lineIndex++;
                        if (byteCount != -1) {
                            response.append(java.lang.System.lineSeparator());
                        }
                    }
                    bufferCount = 0;
                    if (byteCount == -1) {
                        break;
                    }
                }
            } else {
                var reader = new java.io.BufferedReader(new java.io.FileReader(targetFile));
                var line = reader.readLine();
                for (var index = 1; line; index++) {
                    var lineNumber = new java.lang.Integer(index);
                    line = HTTP.escapeHTML(line);
                    response.append('<a name="l%s">%s</a>'.format(lineNumber, line));
                    line = reader.readLine();
                    if (line) {
                        response.append(java.lang.System.lineSeparator());
                    }
                }
            }
        }
        response.append('</code></pre></td></tr></table>');
    } else if (targetFile.isDirectory()) {
        response.append('<style>a, td {font-family: monospace;}');
        response.append('a:hover {color: red;}');
        response.append('table a {display: block; width: 100%;}');
        var link = 'http://png-5.findicons.com/files/icons/1723/humility/16/gnome_fs_directory.png';
        response.append('a.dir {padding-left: 1.5em; background: url("%s") left top no-repeat;}'.format(link));
        link = 'http://png-4.findicons.com/files/icons/1620/crystal_project/16/text_left.png';
        response.append('a.file {padding-left: 1.5em; background: url("%s") left top no-repeat;}'.format(link));
        response.append('td a {min-width: 100px;}');
        response.append('td:nth-child(2) {text-align: right;}');
        response.append('td:not(:first-child) {padding-left: 25px;}</style>');
        response.append(this.makePathAnchors(requestPath));
        response.append('<table cellspacing="0" cellpadding="0" style="border-spacing: 0px;">');
        response.append('<tr style="font-weight: bold;"><td>Name</td><td>Size</td>');
        response.append('<td>Date Modified</td><td>Owner</td><td>Permissions</td></tr>');
        var files = targetFile.listFiles();
        java.util.Arrays.sort(files,
            new java.util.Comparator {compare: function(leftFile, rightFile) {
                var leftType = leftFile.isDirectory();
                var rightType = rightFile.isDirectory();
                if (leftType != rightType) {
                    return leftType ? -1 : 1;
                } else {
                    return 0;
                    return leftFile.getName().compareTo(rightFile.getName());
                }
            }
        });
        files.forEach(function(file, index) {
            response.append('<tr>');
            var styleClass;
            if (file.isDirectory()) {
                styleClass = 'dir';
            } else {
                styleClass = 'file';
            }
            var fileName = new java.io.File(requestPath, file.getName()).toString();
            response.append('<td><a href="%s" class="%s">%s</a></td>'.format(
                fileName, styleClass, file.getName()
            ));
            response.append('<td>%s KB</td>'.format(
                Math.round((file.length() / 1024) * 100) / 100
            ));
            var format = new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss");
            response.append('<td>%s</td>'.format(format.format(file.lastModified())));
            var filePath = java.nio.file.Paths.get(fileName);
            var Files = java.nio.file.Files;
            if (Files.isSymbolicLink(filePath)) {
                response.append('<td></td><td></td>');
            } else {
                response.append('<td>%s</td>'.format(Files.getOwner(filePath).getName()));
                response.append('<td>%s</td>'.format(new File(fileName).getPermissions()));
            }
            response.append('</tr>');
        });
        response.append('</table>');
    }
    response.append('</body></html>');
    this.writeResponse(response.toString(), exchange);
};

Application.prototype.handleRequest = function(exchange) {
    try {
        var requestPath = exchange.getRequestURI().getPath();
        if (requestPath == '/favicon.ico') {
            var responseHeaders = exchange.getResponseHeaders();
            responseHeaders.set('Content-Type', 'image/png');
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().close();
            return;
        }
        var calendar = java.util.Calendar.getInstance();
        var format = new java.text.SimpleDateFormat('HH:mm:ss');
        print(format.format(calendar.getTime()),
            exchange.getRemoteAddress().toString(),
            exchange.getRequestURI().toString()
        );
        this.processResponse(exchange);
        exchange.getResponseBody().close();
    } catch (error) {
        var calendar = java.util.Calendar.getInstance();
        var format = new java.text.SimpleDateFormat('HH:mm:ss');
        print(format.format(calendar.getTime()), error.message);
        exchange.getResponseHeaders().set('Content-Type', 'text/html');
        var response = '<!doctype html><html><body><b>File cannot be accessed<b></body></html>';
        this.writeResponse(new java.lang.String(response), exchange);
        exchange.getResponseBody().close();
    }
};

Application.prototype.run = function(parameters) {
    var port;
    for (var index = 0; index < parameters.length; index++) {
        var match = parameters[index].match(/^(?:(?:-p)|(?:--port=))(\d+)$/);
        if (match) {
            port = parseInt(match[1]);
            continue;
        }
        if (parameters[index].match(/^(-h)|(--help)$/)) {
            print('usage: fileserver.js [options]\n\noptions:\n    -p PORT, --port=PORT        server port');
            return;
        }
    }
    if (!port) {
        print("missing port\nsee 'fileserver.js -h' for usage");
        return;
    }
    print('pid: ' + Process.getIdentifier());
    var port = new java.lang.Integer(port);
    print('port: %d'.format(port));
    var address = new java.net.InetSocketAddress(port);
    var server = com.sun.net.httpserver.HttpServer.create(address, 0);
    var handler = new com.sun.net.httpserver.HttpHandler {handle: this.handleRequest.bind(this)};
    server.createContext('/', handler);
    server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
    server.start();
};

new Application().run(arguments);