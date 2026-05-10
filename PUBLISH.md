# Publishing vdo-rec to npm

## Pre-publish checklist

- [x] Package name available (`vdo-rec`)
- [x] package.json configured
- [x] README updated
- [x] .npmignore created
- [x] Dry-run successful (45KB package)
- [ ] npm login completed
- [ ] Published to npm

## Steps to publish

1. **Login to npm** (one-time setup)
   ```bash
   npm login
   ```
   Enter your npm credentials when prompted.

2. **Publish the package**
   ```bash
   cd nanshi
   npm publish
   ```

3. **Test the published package**
   ```bash
   # From any directory
   npx vdo-rec --screen
   
   # Or install globally
   npm install -g vdo-rec
   vdo --gui
   ```

## After publishing

- Update repository URLs in package.json if you create a GitHub repo
- Add a LICENSE file (currently MIT in package.json)
- Consider adding:
  - GitHub Actions for CI/CD
  - Badges to README (npm version, downloads, etc.)
  - CHANGELOG.md for version history

## Version bumping (for future updates)

```bash
npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
npm version minor   # 0.1.0 → 0.2.0 (new features)
npm version major   # 0.1.0 → 1.0.0 (breaking changes)
npm publish
```

## Package info

- **Name**: `vdo-rec`
- **Command**: `vdo`
- **Size**: 45KB unpacked
- **Node**: >=14.0.0
- **License**: MIT
