@echo off
REM Safely test-restore a backup into a TEMP database (pos_restore_test) and compare
REM counts. Your real "pos" data is never touched. The temp db is dropped at the end.
REM USAGE:  verify-backup.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"

cd /d "%~dp0"
set URI=mongodb://localhost:27017/?replicaSet=rs0
set MONGORESTORE=mongorestore
set MONGOSH=mongosh

if "%~1"=="" (
  echo Drag a backup file onto this script, or run:
  echo    verify-backup.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"
  echo.
  echo Available backups:
  dir /b "%~dp0backups\pos-*.archive.gz"
  pause
  exit /b 1
)

echo Restoring "%~1" into temp db pos_restore_test (real data untouched)...
%MONGORESTORE% --uri="%URI%" --gzip --archive="%~1" --nsFrom="pos.*" --nsTo="pos_restore_test.*" --drop
if %ERRORLEVEL% neq 0 ( echo RESTORE FAILED & pause & exit /b 1 )

echo.
echo Comparing collection counts (pos vs restored)...
%MONGOSH% --quiet --eval "const a=db.getSiblingDB('pos'),b=db.getSiblingDB('pos_restore_test');let ok=true;a.getCollectionNames().filter(n=>!n.startsWith('_')).forEach(n=>{const x=a[n].countDocuments(),y=b[n].countDocuments();print('  '+n+': pos='+x+' restored='+y+(x===y?' OK':' MISMATCH'));if(x!==y)ok=false;});print(ok?'\nBACKUP OK - all collections match.':'\nMISMATCH FOUND.');"

echo.
echo Cleaning up temp db...
%MONGOSH% --quiet --eval "db.getSiblingDB('pos_restore_test').dropDatabase();print('temp db dropped')"
echo Done.
pause
