logFileName=fileserver.txt
if [ "$1" == "stop" ]; then
    lastLine=`tail -n-1 $logFileName`
    if [ "$lastLine" == "killed" ]; then
        echo "file server isn't running"
        exit 1
    fi
    processIndetifier=`head -n1 $logFileName | cut -d: -f2 | tr -d ' '`
    kill $processIndetifier
    echo 'killed' >>$logFileName
else
    nohup ./fileserver.js -p8080 &>$logFileName &
fi