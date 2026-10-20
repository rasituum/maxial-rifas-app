#!/usr/bin/python3
import cgi, os, glob
import cgitb;
import logging;

cgitb.enable(display=0, logdir="/tmp")

form = cgi.FieldStorage()
# Get filename here.
fileitem = form['photo']
numero = form['numero'].value
target = "/var/www/html/rifas/"

os.chdir(target)
photos = glob.glob(str(numero) + '.*')
if len(photos) > 5:
    message = "Too many photos to clean up! probably a bug..."
else:
    for photo in photos:
        os.remove(photo)

# Test if the file was uploaded
if fileitem.filename:
   file_name, file_extension = os.path.splitext(os.path.basename(fileitem.filename))
   # strip leading path from file name to avoid
   # directory traversal attacks
   fn = numero + file_extension
   #fn = os.path.basename(fileitem.filename)
   logging.error(fn)
   f = open(target + fn, 'wb')
   f.write(fileitem.file.read())
   f.close()
   message = 'A foto "' + fn + '" foi enviada com sucesso'
 
else:
   message = 'Nenhuma foto foi enviada'

print('Content-type: text/html')

replyhtml = """
<html>
<body>
<p>%s</p>
     <P>A foto:</P>
     <img src="/rifas/%s" border="0">
</body>
</html>
"""
print(replyhtml %(message,fn))
