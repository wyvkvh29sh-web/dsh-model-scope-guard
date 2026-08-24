window.__ModuleLoader__.load({
  id: 'dsh-model-scope-guard',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')

    function keyOf(target) {
      return `${target.provider}\u0000${target.model}`
    }

    function GuardIcon(props) {
      const active = props.active === true
      const color = active ? '#a78bfa' : '#94a3b8'
      // User-supplied dog mark, with its white square background removed so it
      // adapts cleanly to both DSH light and dark themes.
      return React.createElement('span', { style: { width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement('svg', { viewBox: '0 0 1024 1024', width: '20', height: '20', fill: color, 'aria-hidden': true },
          React.createElement('path', { d: 'M902.3 250.7c-49.5 4.9-87.4-37-95.9-75.3-10.7-48.1-4-125-73.5-128.4-45.5-2.2-59.1 149.4-64.4 106.6-5.3-42.8-53.6-121.9-96.1-82.5-75 69.5-72.2 270.1-72.2 270.1S461.4 403.1 674 466.9c187.2 56.2 280.8-107 280.8-107v-76.7c0-19.5-33-34.4-52.5-32.5z m-177.5 63.8c-20.7 0-37.4-16.8-37.4-37.4 0-20.7 16.8-37.4 37.4-37.4 20.7 0 37.4 16.8 37.4 37.4 0.1 20.6-16.7 37.4-37.4 37.4z' }),
          React.createElement('path', { d: 'M894.2 905c-3-7.6-7.4-14.6-11.9-20.5-9.5-12.4-24.7-19.2-40.4-19.2h-44.8c10.7-16-72.2-444-72.2-444l-222-69.5c-222.1 148.8-268.6 454-278.3 566.7-2 23.2 16.3 43.1 39.5 43.1h345.2c33.5 0 58.2-33.4 46.2-64.7-9.6-25-33.6-36.9-33.6-36.9h-44.1c40.1-90.9-57.7-165.8-57.7-165.8 6.5-16 20.3-13.4 20.3-13.4 42.8 8 69.5 90.9 69.5 90.9l56.2-24.4 48.1 214.2h140.6c29.2 0.2 50.1-29.2 39.4-56.5zM705.7 545.5c-21.1-1.3-42.4-4.4-63.3-9-75.9-16.8-143.9-53.8-191.5-104.2l35-33c41 43.5 100.2 75.5 166.8 90.2 18.6 4.1 37.4 6.8 56 8l-3 48zM207.3 961.7s-157.7-71.1-133.7-220c33.4-207.9 84.2-169.2 76.2-52.8-7 101.2 74.6 97.6 74.6 97.6s-8.6 50.1-12.7 70.3c-5.7 27.8-4.4 104.9-4.4 104.9z' })
        )
      )
    }

    function ScopeGuardButton() {
      const [open, setOpen] = React.useState(false)
      const [pending, setPending] = React.useState(false)
      const [targets, setTargets] = React.useState([])
      const [current, setCurrent] = React.useState(null)
      const [error, setError] = React.useState('')

      const load = async () => {
        const response = await fetch('/model-scope-guard/config', { credentials: 'same-origin' })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || '无法读取管控设置')
        setTargets(Array.isArray(data.targets) ? data.targets : [])
        setCurrent(data.current && typeof data.current.provider === 'string' && typeof data.current.model === 'string' ? data.current : null)
        return data
      }

      const togglePanel = async () => {
        const next = !open
        setOpen(next)
        if (!next) return
        setPending(true)
        setError('')
        try {
          await load()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '无法读取管控设置')
        } finally {
          setPending(false)
        }
      }

      const refreshCurrentModel = async () => {
        if (pending) return
        setPending(true)
        setError('')
        try {
          await load()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '无法获取当前模型')
        } finally {
          setPending(false)
        }
      }

      const save = async (nextTargets) => {
        setPending(true)
        setError('')
        try {
          const response = await fetch('/model-scope-guard/config', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ targets: nextTargets })
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data?.error || '保存失败')
          setTargets(Array.isArray(data.targets) ? data.targets : [])
          setCurrent(data.current && typeof data.current.provider === 'string' && typeof data.current.model === 'string' ? data.current : null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '保存失败')
        } finally {
          setPending(false)
        }
      }

      const currentKey = current ? keyOf(current) : ''
      const currentEnabled = currentKey && targets.some((target) => keyOf(target) === currentKey)
      const toggleCurrent = () => {
        if (!current || pending) return
        const next = currentEnabled
          ? targets.filter((target) => keyOf(target) !== currentKey)
          : [...targets, { provider: current.provider, model: current.model }]
        void save(next)
      }

      return React.createElement('div', { style: { position: 'relative', display: 'inline-flex' } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { void togglePanel() },
          title: targets.length ? `修改范围管控：已选择 ${targets.length} 个模型` : '修改范围管控：未选择模型',
          'aria-label': '配置修改范围管控模型',
          style: {
            border: '0', background: 'transparent', padding: '4px 6px', borderRadius: '6px',
            cursor: 'pointer', lineHeight: '1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 160ms ease, transform 160ms ease'
          }
        }, React.createElement(GuardIcon, { active: targets.length > 0 })), 
        open && React.createElement('div', {
          style: {
            position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', width: '330px', zIndex: 30,
            padding: '12px', borderRadius: '10px', border: '1px solid var(--dsh-border, rgba(148,163,184,.35))',
            background: 'var(--dsh-bg-elevated, #1e293b)', color: 'var(--dsh-fg, #e2e8f0)',
            boxShadow: '0 8px 28px rgba(0,0,0,.24)', fontSize: '12px', lineHeight: 1.5
          }
        },
          React.createElement('div', { style: { fontWeight: 700, fontSize: '13px', marginBottom: '4px' } }, '修改范围管控'),
          React.createElement('div', { style: { color: 'var(--dsh-fg-muted, #94a3b8)', marginBottom: '10px' } }, '仅对选中的模型注入“最小变更、不得越界”的执行约束。'),
          current && React.createElement('button', {
            type: 'button', disabled: pending, onClick: toggleCurrent,
            style: {
              width: '100%', textAlign: 'left', padding: '8px', borderRadius: '7px',
              border: `1px solid ${currentEnabled ? '#22c55e' : 'var(--dsh-border, rgba(148,163,184,.35))'}`,
              background: currentEnabled ? 'rgba(34,197,94,.12)' : 'transparent',
              color: 'inherit', cursor: pending ? 'wait' : 'pointer'
            }
          }, `${currentEnabled ? '✓ 已管控' : '+ 管控当前模型'}  ·  ${current.provider} / ${current.model}`),
          !current && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', color: pending ? 'var(--dsh-fg-muted, #94a3b8)' : '#f59e0b' } },
            React.createElement('span', null, pending ? '正在获取当前模型…' : '暂未获取到当前模型。'),
            !pending && React.createElement('button', {
              type: 'button', onClick: () => { void refreshCurrentModel() },
              style: { border: '1px solid var(--dsh-border, rgba(148,163,184,.35))', borderRadius: '5px', padding: '3px 7px', background: 'transparent', color: 'inherit', cursor: 'pointer' }
            }, '重新获取')
          ),
          React.createElement('div', { style: { marginTop: '10px', fontWeight: 600 } }, `已选模型（${targets.length}）`),
          targets.length === 0
            ? React.createElement('div', { style: { color: 'var(--dsh-fg-muted, #94a3b8)', marginTop: '4px' } }, '切换到某个模型后，点击上方按钮即可将它纳入管控。')
            : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px', maxHeight: '160px', overflowY: 'auto' } },
              targets.map((target) => React.createElement('div', { key: keyOf(target), style: { display: 'flex', gap: '7px', alignItems: 'center', padding: '5px 0' } },
                React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${target.provider} / ${target.model}`),
                React.createElement('button', { type: 'button', disabled: pending, onClick: () => { void save(targets.filter((item) => keyOf(item) !== keyOf(target))) }, style: { border: 0, background: 'transparent', color: '#f87171', cursor: 'pointer', padding: '2px 4px' } }, '移除')
              ))
            ),
          error && React.createElement('div', { style: { color: '#f87171', marginTop: '8px' } }, error)
        )
      )
    }

    function apply(ctx) {
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right', id: 'model-scope-guard', order: 32, label: '修改范围管控'
      }, ScopeGuardButton))
    }

    module.exports = { inject: ['slots'], apply }
    return module.exports
  }
})
