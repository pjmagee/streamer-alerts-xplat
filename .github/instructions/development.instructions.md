---
applyTo: '**/*.ts'
---

To run the project, refer to package.json for the available scripts.

"scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "publish": "electron-forge publish",
    "lint": "eslint --ext .ts,.tsx .",
    "test": "tsx --test",
    "test:watch": "tsx --test --watch tests"
  }