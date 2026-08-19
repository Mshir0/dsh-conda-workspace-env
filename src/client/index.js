(function registerCondaWorkspaceEnvClient() {
  const bundlePath = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href).pathname : '';
  const bundleId = bundlePath.match(/\/plugins\/([^/]+)\/client\.js$/u)?.[1] || 'dsh-conda-workspace-env';
  window.__ModuleLoader__.load({
    id: decodeURIComponent(bundleId),
    factory: require => {
      const { createElement: h, useEffect, useRef, useState } = require('react');
      const API = '/conda-workspace-env';
      const styles = String.raw`
.conda-env-anchor{display:inline-flex;align-items:center;position:relative;min-width:0;font:14px/20px Inter,ui-sans-serif,system-ui,sans-serif;color:#252525}
.conda-env-button{display:inline-flex;align-items:center;gap:7px;height:32px;max-width:210px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background .15s,box-shadow .15s}
.conda-env-button:hover,.conda-env-button[aria-expanded=true]{background:#f5f5f5}.conda-env-button[data-selected=true]{background:#fff;box-shadow:0 1px 4px rgb(0 0 0 / 12%)}
.conda-env-label{font-size:13px}.conda-env-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conda-env-chevron{font-size:15px;color:#737373;transition:transform .15s}.conda-env-button[aria-expanded=true] .conda-env-chevron{transform:rotate(180deg)}
.conda-env-menu{position:fixed;z-index:100;width:260px;max-width:calc(100vw - 24px);max-height:300px;overflow:auto;padding:8px;background:#fff;border:1px solid #e8e8e8;border-radius:12px;box-shadow:0 12px 32px rgb(0 0 0 / 12%)}
.conda-env-option{display:grid;grid-template-columns:20px minmax(0,1fr) 20px;align-items:center;gap:8px;width:100%;min-height:42px;padding:7px 8px;border:0;border-radius:7px;background:transparent;color:#171717;text-align:left;font:14px/18px Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}.conda-env-option:hover{background:#f5f5f5}.conda-env-option-icon{color:#737373;text-align:center}.conda-env-option-copy{min-width:0}.conda-env-option-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conda-env-option-path{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8a8a8a;font-size:11px}.conda-env-check{font-size:18px;text-align:center}.conda-env-error{color:#dc2626}
body[data-ds-dark-theme] .conda-env-anchor{color:#ededed}body[data-ds-dark-theme] .conda-env-button:hover,body[data-ds-dark-theme] .conda-env-button[aria-expanded=true]{background:#292929}body[data-ds-dark-theme] .conda-env-button[data-selected=true]{background:#242424;box-shadow:0 1px 5px #0008}body[data-ds-dark-theme] .conda-env-menu{background:#202020;border-color:#363636;box-shadow:0 14px 36px #0008}body[data-ds-dark-theme] .conda-env-option{color:#ededed}body[data-ds-dark-theme] .conda-env-option:hover{background:#303030}
`;
      async function request(pathname, options = {}) {
        const response = await fetch(`${API}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Conda request failed');
        return body;
      }
      function EnvironmentPicker({ projectPath }) {
        const [items, setItems] = useState([]); const [value, setValue] = useState(''); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const anchorRef = useRef(null);
        useEffect(() => {
          if (!projectPath) return undefined;
          let active = true;
          Promise.all([request('/environments'), request(`/selection?project=${encodeURIComponent(projectPath)}`)])
            .then(([environments, selection]) => { if (active) { setItems(environments); setValue(selection.environment?.prefix || ''); } })
            .catch(cause => { if (active) setError(cause.message); });
          return () => { active = false; };
        }, [projectPath]);
        useEffect(() => {
          if (!open) return undefined;
          const outside = event => { if (!anchorRef.current?.contains(event.target)) setOpen(false); };
          const keydown = event => { if (event.key === 'Escape') setOpen(false); };
          document.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', keydown);
          return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', keydown); };
        }, [open]);
        const save = async prefix => {
          setValue(prefix); setError(''); setOpen(false);
          try { await request('/selection', { method: 'POST', body: JSON.stringify({ projectPath, prefix }) }); }
          catch (cause) { setError(cause.message); }
        };
        const selected = items.find(item => item.prefix === value);
        const rect = open ? anchorRef.current?.getBoundingClientRect() : null;
        const options = [{ name: '未选择', prefix: '', source: 'auto' }, ...items];
        return h('span', { ref: anchorRef, className: `conda-env-anchor${error ? ' conda-env-error' : ''}`, title: error || '当前工作区的 Conda 虚拟环境' },
          h('button', { type: 'button', className: 'conda-env-button', 'data-selected': Boolean(selected), 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: () => setOpen(current => !current) },
            h('span', { className: 'conda-env-label' }, error ? '环境错误' : '环境'),
            h('span', { className: 'conda-env-value' }, selected?.name || '未选择'),
            h('span', { className: 'conda-env-chevron', 'aria-hidden': true }, '⌄')),
          open && rect ? h('div', { className: 'conda-env-menu', role: 'menu', style: { left: Math.max(12, Math.min(rect.left, window.innerWidth - 272)), bottom: window.innerHeight - rect.top + 8 } }, options.map(item => h('button', { key: item.prefix || 'none', type: 'button', className: 'conda-env-option', role: 'menuitemradio', 'aria-checked': value === item.prefix, onClick: () => void save(item.prefix) },
            h('span', { className: 'conda-env-option-icon', 'aria-hidden': true }, item.prefix ? '◇' : '○'),
            h('span', { className: 'conda-env-option-copy' }, h('span', { className: 'conda-env-option-name' }, item.name), item.prefix ? h('span', { className: 'conda-env-option-path' }, item.prefix) : null),
            h('span', { className: 'conda-env-check', 'aria-hidden': true }, value === item.prefix ? '✓' : '')))) : null);
      }
      const inject = ['slots', 'sessions'];
      function apply(ctx) {
        ctx.effect(() => { const style = document.createElement('style'); style.dataset.condaWorkspaceEnv = 'true'; style.textContent = styles; document.head.append(style); return () => style.remove(); }, 'conda-workspace-env: styles');
        ctx.inject(['slots', 'sessions'], scope => scope.slots.inject('conversation.input.left', () => scope.slots.register({
          name: 'conversation.input.left', id: 'conda-workspace-env', order: 110, registrant: 'dsh-conda-workspace-env',
          inject: sessionId => ({ projectPath: scope.sessions.list.getSnapshot().byId[sessionId]?.cwd || '' }),
        }, EnvironmentPicker)));
      }
      return { inject, apply };
    },
  });
})();
