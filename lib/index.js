import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

const ROUTE_PATH = '/model-scope-guard/config'
const SETTINGS_NS = settingsNamespace('model-scope-guard')
const MAX_TARGETS = 40
const MAX_FIELD_LENGTH = 200

const TargetSchema = z.object({
  provider: z.string().min(1).max(MAX_FIELD_LENGTH).required(),
  model: z.string().min(1).max(MAX_FIELD_LENGTH).required()
})
const SettingsSchema = z.object({ targets: z.array(TargetSchema).default([]) })

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify(payload))
}

function sameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  // Same-origin GET requests commonly omit Origin. They only expose this
  // plugin's non-sensitive current-model/target-list view; writes still need
  // an explicit matching Origin header.
  if (typeof origin !== 'string') return request.method === 'GET'
  if (typeof host !== 'string') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJson(request) {
  let text = ''
  for await (const chunk of request) {
    text += String(chunk)
    if (text.length > 20000) throw new Error('请求内容过长')
  }
  return JSON.parse(text)
}

function normalizeTargets(value) {
  if (!Array.isArray(value)) throw new Error('targets 必须为数组')
  if (value.length > MAX_TARGETS) throw new Error(`最多可管控 ${MAX_TARGETS} 个模型`)
  const unique = new Map()
  for (const item of value) {
    if (item === null || typeof item !== 'object') throw new Error('模型信息无效')
    const provider = typeof item.provider === 'string' ? item.provider.trim() : ''
    const model = typeof item.model === 'string' ? item.model.trim() : ''
    if (!provider || !model || provider.length > MAX_FIELD_LENGTH || model.length > MAX_FIELD_LENGTH) {
      throw new Error('厂商和模型名称不能为空，且长度必须合理')
    }
    unique.set(`${provider}\u0000${model}`, { provider, model })
  }
  return [...unique.values()]
}

function isTargeted(targets, selection) {
  return !!selection && targets.some((target) => (
    target.provider === selection.provider && target.model === selection.model
  ))
}

function guardPrompt(selection) {
  return `# 修改范围管控（已对 ${selection.provider}/${selection.model} 启用）

当且仅当用户请求包含调整、修改、优化、修复、重构、替换、删除或类似的变更任务时，必须严格执行以下规则：

1. **以用户明确范围为唯一边界**：只处理用户点名的文件、模块、行为、文本或问题。用户没有明确授权的内容一律视为不在范围内。
2. **禁止擅自扩展**：不得顺带重构、格式化、升级依赖、改命名、改变架构、补充功能、修改配置或优化性能/体验，除非用户明确提出。
3. **范围不清时先澄清**：无法确定具体改动边界时，先提出最少量的澄清问题；不得自行选择更大范围的方案。
4. **最小化变更**：优先使用最小、局部、可逆的改动；不要为了“更优雅”而重写无关实现。
5. **工具与文件操作**：读取为确认范围所必需的最少上下文；仅修改已被用户授权或为实现该授权所不可避免的直接相关内容。发现额外问题时只报告，不要顺手修复。
6. **交付格式**：完成修改类任务时，使用以下清晰格式输出：
   - **修改内容**：逐项说明实际变更；
   - **修改范围**：列出变动的文件/模块及其直接原因；
   - **未修改部分**：说明刻意保持不变的相关部分，或写“除上述范围外未作修改”；
   - **范围外发现**（如有）：只列出发现，不实施处理。

用户的明确要求优先；本规则不阻止完成其明确授权的全部工作。`
}

export const inject = ['webServer', 'systemPrompt', 'agentDefaultModel']

export function apply(ctx) {
  const entry = { targets: [] }
  let source = () => entry
  installSettingsSection(ctx, SETTINGS_NS, SettingsSchema, entry, {
    setSource(next) { source = next },
    onChange() {}
  })

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'model-scope-guard:constraint',
    order: 70,
    text(context) {
      const selected = context?.agent?.options?.provider && context?.agent?.options?.model
        ? { provider: context.agent.options.provider, model: context.agent.options.model }
        : ctx.agentDefaultModel.currentSelection()
      const targets = source().targets
      return isTargeted(targets, selected) ? guardPrompt(selected) : ''
    }
  }), 'model-scope-guard prompt')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (request, response) => {
      if (!sameOrigin(request)) {
        sendJson(response, 403, { error: '仅允许来自当前 Harness 页面的请求' })
        return
      }
      try {
        if (request.method === 'GET') {
          sendJson(response, 200, {
            targets: source().targets,
            current: ctx.agentDefaultModel.currentSelection()
          })
          return
        }
        if (request.method !== 'PUT') {
          response.writeHead(405, { allow: 'GET, PUT' })
          response.end()
          return
        }
        const payload = await readJson(request)
        const targets = normalizeTargets(payload?.targets)
        const settings = ctx.get('settings')
        if (settings !== undefined) {
          await settings.replace(SETTINGS_NS, { targets })
        } else {
          entry.targets = targets
          source = () => entry
        }
        sendJson(response, 200, {
          targets: source().targets,
          current: ctx.agentDefaultModel.currentSelection()
        })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : '保存失败' })
      }
    }
  }), 'model-scope-guard route')
}
