import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { defineTool } from '@deepseek-ai/dsh-tools';

const execFileAsync = promisify(execFile);
export const name = 'conda-workspace-env';
export const inject = ['agents', 'sessions', 'tools'];

async function condaEnvironments() {
  try {
    const { stdout } = await execFileAsync('conda', ['env', 'list', '--json'], { timeout: 10000, maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout);
    return (data.envs || []).map(prefix => ({ name: path.basename(prefix), prefix, source: 'conda' }));
  } catch (error) {
    const wrapped = new Error(`Unable to list Conda environments: ${error.message || String(error)}`);
    wrapped.code = 'CONDA_UNAVAILABLE';
    throw wrapped;
  }
}

function workspaceOf(exec) {
  const cwd = exec?.agent?.session?.header?.cwd;
  if (!cwd) throw new Error('This tool requires an active workspace');
  return path.resolve(cwd);
}

async function readSelection(root) {
  try { return JSON.parse(await readFile(path.join(root, '.context', 'conda-environment.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { workspace: root, environment: null }; throw error; }
}

async function saveSelection(root, environment) {
  await mkdir(path.join(root, '.context'), { recursive: true });
  const value = { workspace: root, environment, updatedAt: new Date().toISOString() };
  await writeFile(path.join(root, '.context', 'conda-environment.json'), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}

function environmentPython(prefix) {
  return path.join(prefix, process.platform === 'win32' ? 'python.exe' : 'bin/python');
}

function environmentPath(prefix) {
  const entries = process.platform === 'win32'
    ? [prefix, path.join(prefix, 'Scripts'), path.join(prefix, 'Library', 'bin')]
    : [path.join(prefix, 'bin')];
  return `${entries.join(path.delimiter)}${path.delimiter}${process.env.PATH || ''}`;
}

async function selectedEnvironment(root) {
  const selection = await readSelection(root);
  const environment = selection.environment;
  if (!environment?.prefix) return null;
  return { ...environment, python: environmentPython(environment.prefix) };
}

export async function runInWorkspaceEnvironment(root, command, args = [], options = {}) {
  const environment = await selectedEnvironment(root);
  if (!environment) throw new Error('No Conda environment is selected for this workspace');
  const executable = command === 'python' || command === 'python3' || command === 'python.exe' ? environment.python : command;
  const env = {
    ...process.env,
    ...(options.env || {}),
    CONDA_PREFIX: environment.prefix,
    CONDA_DEFAULT_ENV: environment.name,
    PATH: environmentPath(environment.prefix),
  };
  const { stdout, stderr } = await execFileAsync(executable, args.map(String), {
    cwd: options.cwd || root,
    env,
    timeout: Math.max(1000, Math.min(120000, Number(options.timeout) || 30000)),
    maxBuffer: 8 * 1024 * 1024,
  });
  return { environment, command: executable, args: args.map(String), stdout, stderr };
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'conda_list_environments',
    description: 'List Conda environments available to the current DSH host.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { return JSON.stringify(await condaEnvironments(), null, 2); },
  }));
  ctx.tools.register(defineTool({
    name: 'conda_run',
    description: 'Run one command with the Conda environment selected for the active workspace. Python commands use that environment interpreter automatically.',
    parameters: {
      command: { type: 'string', description: 'Executable name or path. python/python3 use the selected environment interpreter.' },
      args: { type: 'array', items: { type: 'string' }, description: 'Command arguments.' },
      timeout: { type: 'number', description: 'Timeout in milliseconds, from 1000 to 120000.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      const root = workspaceOf(exec);
      if (!args?.command) throw new Error('command is required');
      const result = await runInWorkspaceEnvironment(root, args.command, Array.isArray(args.args) ? args.args : [], { timeout: args.timeout });
      return JSON.stringify({ environment: result.environment, command: result.command, args: result.args, stdout: result.stdout, stderr: result.stderr }, null, 2);
    },
  }));
  ctx.tools.register(defineTool({
    name: 'conda_workspace_environment',
    description: 'Read or persist the selected Conda environment for the active workspace.',
    parameters: { prefix: { type: 'string', description: 'Exact Conda environment prefix. Omit to read the current selection.' } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      const root = workspaceOf(exec);
      if (!args.prefix) return JSON.stringify(await readSelection(root), null, 2);
      const environments = await condaEnvironments();
      const selected = environments.find(item => item.prefix === args.prefix);
      if (!selected) throw new Error(`Unknown Conda environment: ${args.prefix}`);
      return JSON.stringify(await saveSelection(root, selected), null, 2);
    },
  }));
  ctx.inject(['webServer', 'workspaceRegistry'], webCtx => {
    webCtx.effect(() => webCtx.webServer.register({ kind: 'prefix', path: '/conda-workspace-env', handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://dsh.local');
        if (req.method === 'GET' && url.pathname === '/conda-workspace-env/environments') return json(res, 200, await condaEnvironments());
        const body = req.method === 'POST' ? JSON.parse(await collect(req)) : {};
        const projectPath = body.projectPath || url.searchParams.get('project');
        const root = await registeredWorkspace(webCtx.workspaceRegistry, projectPath);
        if (!root) return json(res, 403, { error: 'Workspace is not registered' });
        if (url.pathname === '/conda-workspace-env/selection' && req.method === 'GET') return json(res, 200, await readSelection(root));
        if (url.pathname === '/conda-workspace-env/selection' && req.method === 'POST') {
          if (!body.prefix) return json(res, 200, await saveSelection(root, null));
          const environments = await condaEnvironments();
          const selected = environments.find(item => item.prefix === body.prefix);
          if (!selected) return json(res, 400, { error: 'Unknown Conda environment' });
          return json(res, 200, await saveSelection(root, selected));
        }
        return json(res, 404, { error: 'Not found' });
      } catch (error) { return json(res, 500, { error: error.message || String(error) }); }
    } }), 'conda workspace environment routes');
  });
}

async function registeredWorkspace(registry, requested) {
  if (!requested) return null;
  const candidate = path.resolve(requested);
  for (const item of registry.list()) if (path.resolve(item.path) === candidate) return candidate;
  return null;
}
async function collect(req) { const parts = []; for await (const part of req) parts.push(part); return Buffer.concat(parts).toString('utf8'); }
function json(res, status, value) { const body = JSON.stringify(value); res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }); res.end(body); }

export { condaEnvironments, readSelection, saveSelection };
