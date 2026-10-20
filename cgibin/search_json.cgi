#!/usr/bin/python3
import cgi, os, glob
import cgitb;
import logging;

cgitb.enable(display=0, logdir="/tmp")

form = cgi.FieldStorage()
numero = form['numero'].value
#numero = 200
target = "/var/www/html/rifas/"

os.chdir(target)
photos = glob.glob(str(numero) + '.*')
logging.error(photos)

if len(photos) > 0:
   img_name = os.path.basename(photos[0])
else:
   img_name = "0.png"

print('Status: 303 See Other')
print('Location: /rifas/' + img_name)
print()
