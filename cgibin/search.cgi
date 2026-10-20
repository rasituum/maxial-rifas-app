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
   message = 'premio %s encontrado !' % numero 
else:
   message = 'este numero %s nao tem premio !' % numero
   img_name = ''

print('Content-type: text/html')

replyhtml = """
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="rifas.css">
</head>
<body>
<p>{message}</p>
<img src="/rifas/{img_name}" border="0" width="100%">
</body>
</html>
"""
print(replyhtml.format(message=message,img_name=img_name))
