@echo off

cd $(dirname $0)


set HOST=github.com

openssl req -new -key master_server.key -out %HOST%.csr -subj "/CN=%HOST%" -config ca/openssl.ca.cnf

openssl ca -config ca/openssl.ca.cnf -notext -startdate 000101000000-0000 -out %HOST%.crt  -infiles %HOST%.csr 
''del %HOST%.csr

pause>nul