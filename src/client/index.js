(function registerCondaWorkspaceEnvClient() {
  const bundlePath = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href).pathname : '';
  const bundleId = bundlePath.match(/\/plugins\/([^/]+)\/client\.js$/u)?.[1] || 'dsh-conda-workspace-env';
  window.__ModuleLoader__.load({
    id: decodeURIComponent(bundleId),
    factory: require => {
      const { createElement: h, useEffect, useState } = require('react');
      const API = '/conda-workspace-env';
      async function request(pathname, options = {}) {
        const response = await fetch(`${API}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Conda request failed');
        return body;
      }
      function EnvironmentPicker({ projectPath }) {
        const [items, setItems] = useState([]); const [value, setValue] = useState(''); const [error, setError] = useState('');
        useEffect(() => {
          if (!projectPath) return undefined;
          let active = true;
          Promise.all([request('/environments'), request(`/selection?project=${encodeURIComponent(projectPath)}`)])
            .then(([environments, selection]) => { if (active) { setItems(environments); setValue(selection.environment?.prefix || ''); } })
            .catch(cause => { if (active) setError(cause.message); });
          return () => { active = false; };
        }, [projectPath]);
        const save = async event => {
          const prefix = event.target.value; setValue(prefix); setError('');
          try { await request('/selection', { method: 'POST', body: JSON.stringify({ projectPath, prefix }) }); }
          catch (cause) { setError(cause.message); }
        };
        return h('label', { title: error || '当前工作区的 Conda 虚拟环境', style: { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          h('span', { style: { fontSize: 12, color: error ? '#dc2626' : 'inherit' } }, error ? '环境错误' : '环境'),
          h('select', { value, onChange: save, style: { maxWidth: 180, height: 28, borderRadius: 5, border: '1px solid #d4d4d8', background: 'transparent', color: 'inherit' } },
            [h('option', { key: '', value: '' }, '未选择'), ...items.map(item => h('option', { key: item.prefix, value: item.prefix }, item.name))]));
      }
      const inject = ['slots', 'sessions'];
      function apply(ctx) {
        ctx.inject(['slots', 'sessions'], scope => scope.slots.inject('conversation.input.left', () => scope.slots.register({
          name: 'conversation.input.left', id: 'conda-workspace-env', order: 110, registrant: 'dsh-conda-workspace-env',
          inject: sessionId => ({ projectPath: scope.sessions.list.getSnapshot().byId[sessionId]?.cwd || '' }),
        }, EnvironmentPicker)));
      }
      return { inject, apply };
    },
  });
})();
