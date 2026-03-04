# Guide de publication

Ce document explique comment publier de nouvelles versions de `@ateliercartographie/ok-palette` sur npm.

## 🚀 Workflow de publication automatisé

Grâce à GitHub Actions, la publication sur npm est **automatique** dès que vous créez un tag Git.

## 📝 Processus de publication

### 1. Faire vos modifications

Développez votre code normalement :

```bash
# Faire des modifications
git add .
git commit -m "feat: nouvelle fonctionnalité"
```

### 2. Mettre à jour le CHANGELOG

Éditez `CHANGELOG.md` pour documenter vos changements sous `## [Unreleased]` :

```markdown
## [Unreleased]

### Added

- Nouvelle fonctionnalité X

### Fixed

- Correction du bug Y
```

Déplacez ensuite ces entrées vers la nouvelle version lors de la release.

### 3. Créer une nouvelle version

Utilisez l'un des scripts suivants selon le type de changement :

```bash
# Pour un correctif (0.1.0 → 0.1.1)
pnpm run release:patch

# Pour une nouvelle fonctionnalité (0.1.0 → 0.2.0)
pnpm run release:minor

# Pour un changement majeur (0.1.0 → 1.0.0)
pnpm run release:major
```

Ces commandes vont automatiquement :

1. ✅ Incrémenter la version dans `package.json`
2. ✅ Créer un commit de version
3. ✅ Créer un tag Git (ex: `v0.1.1`)
4. ✅ Pousser le commit et le tag sur GitHub

### 4. Publication automatique

Une fois le tag poussé sur GitHub, le workflow `.github/workflows/publish-npm.yml` se déclenche automatiquement et :

1. ✅ Installe les dépendances
2. ✅ Build le projet
3. ✅ Publie sur npm
4. ✅ Crée une GitHub Release

Vous pouvez suivre la progression dans l'onglet **Actions** de votre repository GitHub.

## 🔐 Configuration initiale (à faire une fois) — Trusted Publishers (OIDC)

Ce projet utilise **Trusted Publishing** npm avec OIDC (sans `NPM_TOKEN`).

### Prérequis

- Repository **public**
- Workflow GitHub Actions sur un runner **GitHub-hosted**
- npm CLI récent et Node **24** côté workflow

### 1. Configurer le Trusted Publisher sur npmjs.com

1. Allez sur npmjs.com → votre package `@ateliercartographie/ok-palette` → **Settings** → **Trusted publishing**
2. Choisissez **GitHub Actions**
3. Renseignez :
   - **Organization or user**: `AtelierCartographie`
   - **Repository**: `ok-palette`
   - **Workflow filename**: `publish-npm.yml`
   - **Environment name**: laisser vide
4. Enregistrez

### 2. Vérifier le workflow GitHub

Le workflow doit avoir :

- `permissions.id-token: write`
- `npm publish --access public` sans variable `NODE_AUTH_TOKEN`

### 3. Sécurité recommandée (après validation)

Une fois le premier publish OIDC réussi :

1. npmjs.com → package → **Settings** → **Publishing access**
2. Activer **Require two-factor authentication and disallow tokens**
3. Révoquer les anciens tokens d'automatisation inutilisés

## 📊 Semantic Versioning

Nous suivons [Semantic Versioning](https://semver.org/) :

- **PATCH** (0.0.X) : Correctifs de bugs
- **MINOR** (0.X.0) : Nouvelles fonctionnalités (rétrocompatibles)
- **MAJOR** (X.0.0) : Changements cassants (breaking changes)

## 🔄 Publication manuelle (si nécessaire)

Si vous devez publier manuellement :

```bash
# Se connecter à npm
npm login

# Builder le projet
pnpm run build

# Publier
npm publish --access public
```

> Note : en local, `npm publish` continue de fonctionner via `npm login`. Le mode Trusted Publisher s'applique surtout à la CI GitHub Actions.

## ✅ Vérifier la publication

Après publication, vérifiez :

- npm : https://www.npmjs.com/package/@ateliercartographie/ok-palette
- GitHub Releases : https://github.com/AtelierCartographie/ok-palette/releases

## 🐛 Dépannage

### Le workflow ne se déclenche pas

- Vérifiez que le tag commence par `v` (ex: `v0.1.1`)
- Vérifiez dans **Actions** → **Workflows** que le workflow n'est pas désactivé

### Erreur lors de la publication npm

- Vérifiez que la configuration Trusted Publisher correspond exactement (owner/repo/nom du workflow)
- Vérifiez que le workflow a bien `id-token: write`
- Vérifiez que le runner est GitHub-hosted (pas self-hosted)
- Vérifiez les logs dans l'onglet Actions pour plus de détails

### Le nom de version existe déjà

- Vous ne pouvez pas republier la même version
- Incrémentez la version et recommencez
