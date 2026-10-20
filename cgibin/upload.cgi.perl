#!/usr/bin/perl -w
use CGI;

$upload_dir = "/var/www/rifas";
$query = new CGI;
$filename = $query->param("photo");
$numero = $query->param("numero");
$upload_filehandle = $query->upload("photo");

print "Content-type: text/html\n\n";
open UPLOADFILE, ">$upload_dir/$filename";
while ( <$upload_filehandle> )
{
print UPLOADFILE;
}
close UPLOADFILE;

print $query->header ();

print <<END_HTML;
<HTML>
<HEAD>
<TITLE>Thanks!</TITLE>
</HEAD>
<BODY>
<P>Thanks for uploading your photo!</P>
    <P>Your photo:</P>
<img src="/var/www/rifas/$filename" border="0">
</BODY>
</HTML>
