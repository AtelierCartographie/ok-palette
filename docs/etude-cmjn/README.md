# Étude — des palettes CMJN dans ok-palette (et Khartis)

*Novembre 2026 — étude exploratoire ; le prototype de ce dossier a servi aux mesures.*

> **Mise en œuvre (ok-palette, branche `claude/khartis-cmjn-support-fe4202`).** L'option est intégrée sous une forme plus simple que le `GamutDescriptor` du §4 : `gamut: "cmyk-coated" | "cmyk-uncoated"` (chaînes, comme `"srgb"` et `"p3"`). Chaque gamut est l'**intersection des deux générations de normes** (couché : FOGRA39 ∩ FOGRA51 ; non couché : FOGRA29 ∩ FOGRA52), car une palette calculée pour FOGRA29 seul a 6 à 9 % de classes hors gamut en FOGRA52. Tables générées par `scripts/build-cmyk-gamuts.ts`, contrôle par `scripts/diagnose-cmyk.ts` : 0 classe non imprimable sur 1 959, avec chacun des quatre profils. Après essais dans le générateur, le plancher de luminosité a été relevé (0,34 en couché, 0,50 en non couché : là où la chroma imprimable médiane atteint 0,06, le gamut se refermant en pointe vers le noir) et la perte de chroma près du noir est étalée sur les classes sombres des rampes : sinon la dernière classe virait au gris, en rupture avec les autres. Voir la section *Print (CMYK)* du README principal.
>
> **Ajout depuis l'étude — l'export via Illustrator.** Un SVG en sRGB ouvert dans Illustrator puis passé en CMJN est converti avec les réglages couleur du document. Les réglages européens d'Adobe cochent la *compensation du point noir* : elle éclaircit les classes sombres, alors qu'elles sont déjà au-dessus du noir imprimable. Écart à l'impression, palettes contraintes (p95 / max ΔE00) : relative 1,5 / 2,0 en couché et 1,5 / 1,8 en non couché ; relative + BPC 3,2 / 4,4 et 8,7 / 9,0 ; perceptive 3,3 / 4,2 et 8,5 / 8,8. Le flux « palette CMJN + SVG → Illustrator » couvre bien le besoin **à condition de décocher la BPC** (ou de convertir via *Convertir en profil*, intention relative, sans BPC) — à intégrer à la documentation de Khartis si l'équipe retient ce flux.

## En bref

- **L'idée tient, et elle est la bonne.** Contraindre les palettes en amont au gamut d'impression marche exactement comme la contrainte sRGB actuelle : on garde la luminosité et la teinte de chaque classe, on plafonne la chroma au maximum imprimable. Sur 12 palettes types, ce plafond fait passer les classes hors gamut de **40 sur 95 à 1** (papier couché FOGRA39), et la seule restante relève d'un autre problème (le noir, ci-dessous).
- **Le CMJN ajoute une contrainte que le sRGB n'avait pas : un noir qui n'est pas noir.** Le noir le plus profond imprimable correspond à **OKLab L ≈ 0,23 sur papier couché** et **≈ 0,40 sur papier non couché**. Or les palettes séquentielles d'ok-palette descendent jusqu'à L = 0,10 (contraste élevé, 9 classes) : à l'impression, les 2 ou 3 classes les plus sombres deviennent la même couleur. Il faut donc aussi un **plancher de luminosité**, et pas seulement un plafond de chroma.
- **jsColorEngine est le moteur qui manquait**, mais **ok-palette n'a pas besoin de l'embarquer**. Il suffit de l'utiliser *une fois*, hors ligne, pour précalculer une table « chroma max par (luminosité, teinte) » d'environ **4 Ko par profil**. ok-palette reste sans dépendance. C'est le même principe que les LUT de jsColorEngine (calculer une fois, livrer une table), appliqué à une question plus petite : *où est la frontière du gamut ?* plutôt que *quelle est la valeur CMJN de chaque pixel ?*
- **Khartis, lui, a intérêt à embarquer jsColorEngine** (chargé à la demande, ~115 Ko gzip) pour trois usages : afficher les valeurs CMJN des classes, convertir à l'export, et calculer à la volée la table d'un profil ICC fourni par l'imprimeur (moins de 0,1 s).

## 1. jsColorEngine aujourd'hui

État du dépôt au 1ᵉʳ novembre 2026 (v1.7.1) :

| | |
|---|---|
| Couverture | Moteur ICC complet : profils v2/v4 à tables (CMJN) et matrice-courbes (RGB), les 4 intentions de rendu, compensation du point noir (BPC), DeviceLink, N couleurs |
| Exactitude | Validé contre LittleCMS (la référence libre) : ≤ 0,06 ΔE76 en sortie Lab, ≤ 0,04 % d'encre en CMJN |
| Vitesse | Une conversion isolée en précision f64 : **~1 µs** mesuré ici (aller-retour Lab → CMJN → Lab sur FOGRA39) |
| Poids | ~115 Ko gzip (bundle navigateur, WASM inclus), zéro dépendance |
| LUT portables | Une transformation se « cuit » en JSON (`Transform.fromJSON`) : plus besoin du profil ICC à l'exécution. ~650 Ko pour une LUT CMJN 4D |
| Gamut | Avertissement de gamut intégré (`lutGamutMode`), fondé sur l'écart aller-retour, la même méthode que ce prototype |
| Licence | **MPL-2.0** (anciennement GPL-3.0) : copyleft au niveau du fichier seulement, utilisable depuis du code ISC, GPL ou propriétaire |
| Risque | Un seul auteur (205 commits sur 205), 44 étoiles. Voir §6 |

Ce qu'il **ne fait pas** : encoder des images. Son projet frère [jsICCImage](https://github.com/glennwilton/jsICCImage) (MIT) gère l'épreuvage écran, mais n'encode ni JPEG ni TIFF.

## 2. Ce que deviennent à l'impression les palettes sRGB actuelles

Méthode : chaque classe est convertie OKLCH → Lab D50 → CMJN → Lab avec jsColorEngine, en colorimétrie relative sans BPC (voir §7). Une classe est dite **hors gamut** si l'aller-retour s'écarte de plus de **ΔE00 = 2**. Le bruit propre aux profils sur des couleurs imprimables est de ΔE00 ≈ 0,5 en médiane et ≈ 1 au 95ᵉ centile dans les tons moyens. La **séparation** est l'écart ΔE OK minimal entre classes voisines (palettes séquentielles et divergentes) ou entre toutes les paires (palettes catégorielles), à l'écran → à l'impression.

**Papier couché, FOGRA39** (ISO Coated v2, le standard européen le plus courant en édition et en revue) :

| Palette | sRGB actuel : hors gamut | ΔE00 max | séparation | **Plafond CMJN** : hors gamut | ΔE00 max | séparation |
|---|---|---|---|---|---|---|
| séq. steelblue, 7 | 1/7 | 4,0 | 0,097 → 0,093 | 0/7 | 1,1 | 0,097 → 0,094 |
| séq. #2b83ba, 9, contraste élevé | 3/9 | 10,9 | 0,112 → **0,011** | 1/9 | 5,8 | 0,111 → **0,000** |
| séq. #008837 (vert), 7 | 4/7 | 6,7 | 0,097 → 0,079 | 0/7 | 1,3 | 0,097 → 0,092 |
| séq. #7b3294 (violet), 7 | 6/7 | 7,4 | 0,098 → 0,084 | 0/7 | 1,4 | 0,099 → 0,095 |
| séq. #d7191c (rouge), 7 | 2/7 | 6,1 | 0,098 → 0,073 | 0/7 | 1,3 | 0,099 → 0,091 |
| séq. gold, 5 | 2/5 | 4,9 | 0,110 → 0,110 | 0/5 | 1,0 | 0,111 → 0,112 |
| séq. bi-ton #f4e285 → #1d3557, 7 | 0/7 | 0,9 | 0,099 → 0,098 | 0/7 | 0,9 | 0,099 → 0,098 |
| div. #d7191c / #2b83ba, 5+5 | 1/10 | 4,6 | 0,064 → 0,065 | 0/10 | 1,0 | 0,064 → 0,065 |
| div. #7b3294 / #008837, 4+4 | 2/8 | 4,5 | 0,079 → 0,078 | 0/8 | 1,6 | 0,079 → 0,078 |
| catég. vif, 8 | 6/8 | 10,5 | 0,180 → 0,113 | 0/8 | 1,5 | 0,131 → 0,123 |
| catég. vif, 12 | 9/12 | 10,5 | 0,090 → **0,044** | 0/12 | 1,5 | 0,110 → 0,109 |
| catég. pastel, 8 | 4/8 | 7,6 | 0,089 → 0,064 | 0/8 | 1,4 | 0,076 → 0,069 |

**Papier non couché, FOGRA29** (édition courante, livres) : même tendance, en plus marqué. En sRGB, les classes hors gamut s'écartent de ΔE00 = 9 à 26 selon les palettes. Avec le plafond, il reste une à trois classes hors gamut par palette séquentielle, toujours les plus sombres, sous le noir imprimable (§3).

À retenir :

1. **Plus de 4 classes actuelles sur 10 ne s'impriment pas comme elles s'affichent**, même sur un bon papier couché. Les violets, les verts et les palettes catégorielles vives sont les plus touchés.
2. **Les écarts ne restent pas cosmétiques** : deux classes catégorielles se rapprochent jusqu'à 0,044, deux classes séquentielles sombres se confondent (0,011).
3. **Plafonner en amont préserve la structure**. Pour les palettes catégorielles, il faut plafonner *pendant* la sélection et pas après : l'algorithme choisit alors des luminosités qui gardent les couleurs écartées. Avec 12 classes vives, la séparation imprimée passe de 0,044 à 0,109. C'est précisément ce qu'une simple simulation ne peut pas faire.

## 3. Ce qui change entre sRGB et CMJN

### Le gamut CMJN n'est pas inclus dans le sRGB

| Teinte | C max sRGB | C max FOGRA39 | C max FOGRA29 |
|---|---|---|---|
| rouge (25°) | 0,251 | 0,246 | 0,195 |
| jaune (90°) | 0,176 | **0,191** | 0,174 |
| vert (140°) | 0,277 | 0,194 | 0,150 |
| cyan (195°) | 0,154 | **0,192** | 0,136 |
| bleu (250°) | 0,187 | 0,181 | 0,133 |
| violet (300°) | 0,289 | 0,150 | 0,101 |

En volume, le FOGRA39 conserve **~53 %** du sRGB et le FOGRA29 **~29 %**. Mais le FOGRA39 *dépasse* aussi le sRGB dans les cyans et les jaunes (~9 % du volume sRGB). Comme la palette doit aussi s'afficher correctement à l'écran dans Khartis, la cible est l'**intersection sRGB ∩ CMJN**. Et la sortie d'ok-palette reste un `oklch()` affichable partout.

### La plage de luminosité est bornée

En colorimétrie relative, le blanc du papier devient le blanc (L = 1), il n'y a donc rien à faire en haut de la plage. En bas en revanche :

| Profil | Noir imprimable (L\*) | En OKLab L |
|---|---|---|
| FOGRA39 couché | 10,6 | **0,23** |
| FOGRA29 non couché | 29,9 | **0,40** |

Les bornes de luminosité de `getAdaptiveBounds` descendent jusqu'à 0,25 (contraste normal) et 0,10 (contraste élevé). Prototype : quand la borne sombre passe sous le noir du profil, on la remonte au noir + 0,04 et on réinterpole la rampe. Séparation imprimée minimale entre classes voisines :

| Palette | FOGRA39, chroma seule | FOGRA39, chroma + plancher | FOGRA29, chroma seule | FOGRA29, chroma + plancher |
|---|---|---|---|---|
| séq. #2b83ba, 9, élevé | 0,000 (1 hors gamut) | **0,087** (0) | 0,000 (3) | **0,067** (0) |
| séq. #2b83ba, 9, normal | 0,087 (0) | 0,082 (0) | 0,000 (2) | **0,064** (0) |
| séq. #008837, 5, élevé | 0,164 (0) | 0,164 (0) | 0,084 (1) | **0,128** (0) |

Il y a une conséquence physique qu'aucun algorithme ne peut contourner : **sur papier non couché, la plage de luminosité utile passe d'environ 0,72 à 0,53**. Les classes sont donc plus proches entre elles. Khartis pourrait le signaler (« au-delà de 7 classes sur papier non couché, les classes sombres seront difficiles à distinguer »).

## 4. Architecture proposée

### ok-palette : un descripteur de gamut, pas un moteur

```ts
/** Ce que l'algorithme a besoin de savoir d'un gamut */
interface GamutDescriptor {
  id: string;                     // "fogra39"
  label: string;                  // "Papier couché (FOGRA39)"
  lightness: [min: number, max: number]; // plage OKLab L imprimable (plancher = noir + marge)
  maxChroma(l: number, h: number): number; // déjà intersecté avec le sRGB
}

// Usage
import { sequential, categorical } from "@ateliercartographie/ok-palette";
import { fogra39, fogra52 } from "@ateliercartographie/ok-palette/gamuts";

sequential({ colorStart: "steelblue", steps: 7, gamut: fogra39 });
categorical(8, { ...presets.vif, gamut: fogra52 });
```

- `gamut` accepte en plus un objet `GamutDescriptor`. `"srgb"`, `"p3"` et `"none"` restent inchangés.
- `maxChroma` d'un descripteur CMJN se lit dans une table **L (pas de 0,02) × H (pas de 5°) = 3 672 valeurs**, avec interpolation bilinéaire et une marge de 0,006. En `Uint8`, cela fait **3,7 Ko (4,9 Ko en base64) par profil**, et la table n'est chargée que si on importe `/gamuts`. Vérification : sur 12 palettes, la table donne **exactement les mêmes résultats** qu'un calcul exact par jsColorEngine. Sans marge, le pire dépassement est de ΔE00 2,6 en couché.
- Les tables sont produites par un script (`scripts/build-gamuts.ts`) qui a jsColorEngine en **devDependency** uniquement, sur le modèle de `table.ts` dans ce dossier.
- Il faut modifier trois endroits du code :
  1. `formatOklch` : plafond `min(maxChroma sRGB, descripteur)` ;
  2. `sequentialOklch`, `divergent*` : bornes de `getAdaptiveBounds` ramenées dans `lightness` ;
  3. `categorical` : `lightnessRange` coupé à `lightness`, et plafond appliqué **dans** la boucle de sélection, ligne 126, déjà le cas pour sRGB et P3.
- La sortie reste du CSS `oklch()`, affiché tel quel à l'écran puisque la couleur est dans le sRGB, et convertible sans perte (ΔE00 < 2) en CMJN par le même profil.

### Khartis : jsColorEngine au runtime, chargé à la demande

| Usage | Comment | Coût |
|---|---|---|
| Choisir « Impression : papier couché / non couché » | Passe le descripteur à ok-palette. Rien d'autre | ~4 Ko |
| Afficher les valeurs CMJN de chaque classe (pour l'imprimeur, pour Illustrator) | `Transform` Lab → CMJN, colorimétrie relative, sans BPC | jsColorEngine + profil ICC, *ou* une LUT JSON cuite |
| Profil ICC de l'imprimeur | Le calcul de la table de gamut à partir du profil envoyé prend **moins de 0,1 s**, puis passe à ok-palette | jsColorEngine |
| Épreuvage écran (simulation) | `createMultiStage(['*sRGB', profil, '*sRGB'])` sur l'aperçu. Utile comme **contrôle** du fond de carte, des images, des textes, mais pas comme outil pour corriger une palette | jsColorEngine |
| Export | Voir ci-dessous | — |

**Export.** Pour une carte vectorielle, le livrable que les imprimeurs attendent est en général un **PDF/X** avec des couleurs DeviceCMYK et une *OutputIntent* (le profil). Un JPEG CMJN avec profil ICC convient pour un visuel inséré dans une maquette, mais :

- jsColorEngine convertit les pixels, pas le format : il faudra un **encodeur JPEG CMJN** (rare en JS) ou passer par le TIFF ;
- un JPEG aplatit textes et traits fins (le texte noir ne doit pas devenir un noir quadri) ;
- c'est donc un chantier distinct de la palette, utile mais secondaire, et à valider avec les éditeurs partenaires.

### Les « LUTs » dans tout cela

Deux tables différentes répondent à deux questions différentes :

| | Table de gamut (ok-palette) | LUT de conversion (Khartis) |
|---|---|---|
| Question | Quelle chroma maximale pour (L, H) ? | Quelles valeurs CMJN pour cette couleur ? |
| Taille | ~4 Ko | ~150 à 650 Ko selon la grille |
| Produite par | Un script, une fois, avec jsColorEngine | `new Transform({buildLut:true})` puis `JSON.stringify` |
| Runtime | Aucune dépendance | `Transform.fromJSON` (jsColorEngine) |

## 5. Quels profils proposer

À valider avec les imprimeurs et les éditeurs. Pistes :

- **FOGRA39 / ISO Coated v2** : encore le plus demandé pour les revues et les ouvrages sur papier couché.
- **FOGRA51 / PSO Coated v3** et **FOGRA52 / PSO Uncoated v3** : leurs successeurs (ISO 12647-2:2013), à surveiller.
- **FOGRA29 / Uncoated** : le profil non couché historique.

**Licence des profils** *(corrigé)* : les profils ECI (PSOcoated_v3, PSOuncoated_v3_FOGRA52, disponibles sur le [registre de l'ICC](https://registry.color.org/profile-registry/), le site de l'ECI ne servant plus ses archives) peuvent être « utilisés, incorporés et échangés sans restriction » mais **pas redistribués ni modifiés** sans accord écrit de l'ECI. Ils ne sont donc pas versionnés (dossier `icc/` ignoré par git). Les tables de gamut, données dérivées de quelques kilo-octets, ne contiennent pas le profil.

## 6. Risques et limites

- **Un seul mainteneur.** Le risque est contenu : ok-palette ne dépend de jsColorEngine qu'à la génération des tables, qui restent valables même si le projet s'arrête. Pour Khartis, LittleCMS en WASM (`lcms-wasm`) reste une alternative de repli de même nature.
- **Seuil ΔE00 = 2.** Il est au-dessus du bruit propre aux profils (~1) et sous la tolérance de presse habituelle (ISO 12647-2, de l'ordre de 3 à 5 en aplat). Ce paramètre reste à discuter.
- **Le profil n'est pas la presse.** Il décrit une condition d'impression standard. Ce qui garantit le rendu, c'est que l'imprimeur travaille dans cette condition.
- **Noirs riches et taux d'encrage.** Les tables B2A des profils intègrent déjà la limite d'encrage (TAC) : un CMJN obtenu par conversion la respecte.

## 7. Point de vigilance pour l'export : l'intention de rendu

Une palette contrainte au gamut doit être convertie en **colorimétrie relative, sans BPC** :

- l'intention *perceptuelle* compresse *aussi* les couleurs déjà dans le gamut, ce qui annulerait le travail ;
- la BPC rééchelonne les luminosités, alors qu'elles sont déjà dans la plage imprimable grâce au plancher.

Le reste de la carte (photos, fonds) peut avoir besoin d'un autre réglage. C'est un choix d'export, pas de palette.

## 8. Suite proposée

1. **ok-palette** : `GamutDescriptor` + `scripts/build-gamuts.ts` (jsColorEngine en devDependency, profils ECI) + export `/gamuts` (FOGRA39, FOGRA52, éventuellement FOGRA51). Étendre `scripts/diagnose-*.ts` pour mesurer chaque palette contre ces gamuts.
2. **Khartis, phase 1** : un sélecteur « Impression » qui passe le descripteur. Aucune nouvelle dépendance runtime.
3. **Khartis, phase 2** : jsColorEngine chargé à la demande pour afficher les valeurs CMJN des classes, charger un profil ICC d'imprimeur et faire l'épreuvage écran.
4. **Khartis, phase 3** : export d'impression (PDF/X ou image CMJN), après avoir demandé aux éditeurs ce qu'ils attendent.

## Annexe — reproduire les mesures

Les scripts de ce dossier utilisent les profils Adobe de `/Library/Application Support/Adobe/Color/Profiles/Recommended/` (chemins dans `engine.ts`) et un clone de jsColorEngine :

```bash
git clone --depth 1 https://github.com/glennwilton/jsColorEngine.git /tmp/jsce
cd docs/etude-cmjn
export JSCE=/tmp/jsce/src/main.js
node table.ts      # tables de gamut OKLCH (tables.json) + comparaison par teinte
node calib2.ts     # bruit d'aller-retour des profils, par tranche de luminosité
node palettes.ts   # palettes ok-palette : sRGB actuel vs plafond CMJN (table et exact)
node lfloor.ts     # effet du plancher de luminosité
```

`categorical-cap.ts` est une copie de `src/categorical.ts` qui accepte un plafond CMJN injecté. C'est du code de prototype, à ne pas réutiliser tel quel.

## Annexe — export des valeurs CMJN depuis le générateur (évaluation)

Idée : en destination papier, le générateur donnerait, en plus des `oklch()`, les valeurs CMJN de chaque classe pour un profil choisi. L'usager les saisit directement dans un document CMJN (Illustrator, InDesign) : **aucune conversion n'a lieu**, donc ni compensation du point noir ni intention de rendu à régler. C'est l'argument principal.

Points établis par la mesure (jsColorEngine, profil PSO Coated v3, palettes `cmyk-coated`) :

- **Les valeurs dépendent du profil.** Deux profils couchés ne donnent pas les mêmes pourcentages pour une même couleur (séparation et génération du noir différentes). L'export doit donc demander « pour quel profil ? » (FOGRA39, FOGRA51, FOGRA29, FOGRA52) et le rappeler à côté des valeurs. Le gamut d'intersection garantit que la couleur est imprimable avec chacun.
- **Calcul dans le navigateur.** La palette change à chaque réglage, il faut donc convertir côté client. jsColorEngine se charge à la demande (~115 Ko gzip). La transformation se « cuit » en LUT JSON hors ligne : pas besoin de servir le profil ICC. Taille et précision d'une LUT sRGB → CMJN, par profil :

| Grille | gzip | Écart d'encre max | ΔE00 max à l'impression (arrondi au %) |
| --- | --- | --- | --- |
| 17 points | 34 Ko | 8–10 % | 1,5–2,3 |
| 33 points | 241 Ko | 3,4 % | 0,85–0,94 |

  Une grille de 33 points est nécessaire, soit ~360 Ko chargés au clic sur « Exporter en CMJN » pour un profil. Les écarts d'encre de quelques % viennent de la redondance du noir (plusieurs CMJN donnent la même couleur) : la couleur imprimée, elle, reste à moins de ΔE00 1.
- **Licence, à trancher avant de publier.** Une LUT cuite à partir d'un profil ECI reproduit sa transformation. Est-ce une « redistribution » ou une « modification » au sens de la licence ECI ? À demander à l'ECI, ou calculer les valeurs d'une autre façon (données de caractérisation FOGRA publiques, voir le registre de l'ICC).
- **Où le placer.** Dans le site (générateur), pas dans ok-palette, qui reste sans dépendance et ne connaît que les gamuts. Khartis pourrait réutiliser plus tard les mêmes LUT si l'équipe retient l'export CMJN.

