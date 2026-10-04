# Fonctionnement de PreScan

PreScan est une plateforme d'aide au dépistage des anomalies cérébrales fœtales à partir d'images d'échographie prénatale. Elle est réservée aux médecins dont le compte a été validé par un administrateur.

Pour lancer une analyse, le médecin ouvre la page « Nouvelle analyse », choisit un patient pseudonymisé et téléverse une image au format PNG ou JPEG de 10 Mo maximum. L'image est stockée dans un espace privé, puis envoyée au modèle d'intelligence artificielle par un service sécurisé.

Le résultat contient la classe la plus probable, un niveau de confiance, les trois classes alternatives les plus probables et la probabilité de chacune des 16 classes. Le médecin peut confirmer le résultat ou le corriger en indiquant la classe qu'il retient.

Chaque patient est identifié par un code généré automatiquement. Aucun nom, aucune date de naissance et aucun numéro de dossier ne doivent être saisis dans PreScan.

Chaque médecin ne voit que ses propres patients, examens et résultats. Les validations et corrections sont enregistrées dans un journal d'audit.
