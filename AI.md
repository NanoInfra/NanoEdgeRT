1. if you written some new api or modified any api, please update openapi.js
2. the version is semantic version, update the version at deno.json carefully, if version is adjusted, write changelog in CHANGELOG.md
3. if you modified the arch, please update even rewrite the README.md
4. run all the tests by `deno run test`, fix all errors
5. run `deno run precommit` hook, for checking if the code is suitable for commiting
