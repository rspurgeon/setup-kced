# setup-kced

Install kced from the https://github.com/Kong/go-apiops repository so that it can be used in your GitHub Actions workflows

Add the following to your `steps` definition to install the latest version of `kced`:

```yaml
- uses: rspurgeon/setup-kced@v1
```

## Sample workflow

```yaml
on:
  push:
    branches:
      - main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: rspurgeon/setup-kced@v1
      - run: kced version
```

You can also specific a specific version to install with the `kced-version` input:

```yaml
- uses: rspurgeon/setup-kced@v1
  with:
    kced-version: 0.1.11
```

## Capturing output

If you need to capture the output for use in a later step, you can add a wrapper script which exposes `stdout` and `stderr` by passing the `wrapper` input and setting it to `true`:

```yaml
steps:
  - uses: rspurgeon/setup-kced@v1
    with:
      kced-version: 0.1.11
      wrapper: true
  - run: kced version
    id: kced_version
  - run: echo '${{ toJson(steps.kced_version.outputs) }}'
```

This would produce the following output:

```json
{
  "stderr": "",
  "stdout": "kced v0.1.11 (commit) \n"
}
```
