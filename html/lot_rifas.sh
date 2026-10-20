#!/bin/bash

# Vérifier que deux arguments sont fournis
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <fichier_source> <nombre_de_copies>"
    exit 1
fi

fichier_source="$1"
nombre_de_copies="$2"

# Vérifier que le fichier source existe
if [ ! -f "$fichier_source" ]; then
    echo "Erreur : Le fichier '$fichier_source' n'existe pas."
    exit 1
fi

# Extraire le nom de base (supposé être un nombre) et l'extension
nom_base="${fichier_source%.*}"
extension="${fichier_source##*.}"

# Vérifier que le nom de base est un nombre
if ! [[ "$nom_base" =~ ^[0-9]+$ ]]; then
    echo "Erreur : Le nom de base du fichier doit être un nombre (ex: 960.jpg)."
    exit 1
fi

# Boucle pour créer les copies avec incrémentation du nom
for ((i=1; i<=$nombre_de_copies; i++)); do
    nouveau_numero=$((nom_base + i))
    nouveau_nom="${nouveau_numero}.${extension}"
    cp "$fichier_source" "$nouveau_nom"
    echo "Copie créée : $nouveau_nom"
done

echo "Toutes les copies ont été créées avec succès."
