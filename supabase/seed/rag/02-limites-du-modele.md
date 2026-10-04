# Limites du modèle et bon usage

Le résultat de PreScan est une aide au dépistage. Il ne remplace ni l'examen échographique complet, ni l'avis d'un professionnel de santé qualifié, et il doit toujours être confirmé par un médecin avant toute décision clinique.

Le modèle classe l'image parmi un ensemble fixe de 16 classes. Il ne peut pas reconnaître une anomalie qui n'appartient à aucune de ces classes. Une probabilité élevée n'est pas une certitude : elle mesure la confiance du modèle, pas la probabilité réelle que le fœtus présente l'anomalie.

Lorsque la confiance est inférieure au seuil configuré, PreScan affiche une alerte « confiance faible ». Dans ce cas, le résultat ne doit pas être utilisé seul.

La qualité de l'image influence le résultat : plan de coupe inadapté, image floue, artefacts ou compression excessive peuvent dégrader la prédiction. Les images doivent être comparables à celles utilisées pour entraîner le modèle.

Le modèle n'a pas été évalué sur toutes les populations, tous les appareils ni tous les âges gestationnels. Ses performances sur le terrain peuvent différer de celles mesurées pendant la validation.

L'assistant documentaire de PreScan explique la plateforme et ses limites. Il ne pose aucun diagnostic et n'interprète aucune image.
