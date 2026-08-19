# dsh-conda-workspace-env

DeepSeek Harness plugin for listing Conda environments and selecting one for the active workspace.

The selection is stored at `.context/conda-environment.json` and is workspace-scoped. The plugin does not activate or mutate Conda environments; it records the exact prefix for tools and future session startup integration. The picker is shown in the conversation input toolbar for the active workspace; it is also available to agents through `conda_list_environments` and `conda_workspace_environment`.

Install from a local checkout:

```bash
pnpm dsh plugin --profile web add -w /path/to/dsh-conda-workspace-env
pnpm dsh web
```
