# Private storage

[Cloudflare R2 setup](R2_SETUP.md) covers bucket creation, scoped credentials,
backend and Docker configuration, and connection checks. The backend also supports
local disk storage through `STORAGE_DRIVER=local`.

Run storage checks from the repository's `Backend/` folder:

```sh
npm run test:storage
npm run test:tika:r2
```

The second command checks extraction through live Tika and persistence in the
configured R2 bucket using disposable fixtures.

[Backend reference](../README.md) · [Documentation index](../../README.md)
