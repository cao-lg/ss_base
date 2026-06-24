/**
 * 智能体对话代理
 * POST /api/chat
 *
 * 请求体：{ projectId, agentType, query, conversationId? }
 *
 * 流程：
 *   1. 验证用户登录
 *   2. 查找 Bot ID
 *   3. 检查教学站积分 → 扣积分
 *   4. 用学生的 OAuth token 调 Coze Chat API（消耗学生自己的 Coze 额度）
 *   5. 记录学习日志
 *   6. 流式返回智能体回复
 */
import KV from '../lib/kv.js';
import { getBotId, getAgentMeta, COZE_API_BASE } from '../lib/config.js';

export async function onRequestPost({ env, data, request }) {
  if (!data?.session) {
    return Response.json({ error: '未登录，请先登录' }, { status: 401 });
  }

  const body = await request.json();
  const { projectId = '', agentType = 'guide', query = '', conversationId = '' } = body;

  if (!query.trim()) {
    return Response.json({ error: '消息不能为空' }, { status: 400 });
  }

  // 查找 Bot ID
  const botId = getBotId(projectId, agentType);
  if (!botId) {
    return Response.json({
      error: `智能体未配置：${agentType}。请在 functions/lib/config.js 中填写 Bot ID。`,
    }, { status: 503 });
  }

  const { userId, accessToken } = data.session;
  const meta = getAgentMeta(agentType);

  // 检查并扣除教学站积分
  const spendResult = await KV.spendCredits(env, userId, meta.cost);
  if (!spendResult.ok) {
    return Response.json({ error: spendResult.error, credits: 0 }, { status: 403 });
  }

  // 调用 Coze Chat API（用学生的 token）
  try {
    const cozeBody = {
      bot_id: botId,
      user_id: userId,
      query: query,
      stream: true,
      auto_save_history: true,
    };
    if (conversationId) {
      cozeBody.conversation_id = conversationId;
    }

    const cozeResp = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cozeBody),
    });

    if (!cozeResp.ok) {
      const errText = await cozeResp.text();
      // 扣费失败要退回积分
      await KV.earnCredits(env, userId, meta.cost);

      let errMsg = `Coze API 错误 (${cozeResp.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.msg || errJson.message || errMsg;
      } catch {}

      return Response.json({ error: errMsg, raw: errText }, { status: 502 });
    }

    // 记录学习日志
    await KV.addLog(env, userId, {
      action: `agent_${agentType}`,
      agentType,
      cost: meta.cost,
      message: query.slice(0, 200),
      page: projectId || '/',
    });

    // 流式转发 SSE 响应
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = cozeResp.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // 解析 SSE 事件
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;

              try {
                const event = JSON.parse(jsonStr);

                // 提取回复内容
                if (event.event === 'conversation.message.completed' ||
                    event.event === 'conversation.message.delta') {
                  if (event.message && event.message.type === 'answer') {
                    const content = event.message.content || '';
                    if (event.event === 'conversation.message.completed') {
                      fullReply = content;
                    }

                    // 转发给前端
                    writer.write(encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'delta',
                        content: event.event === 'conversation.message.delta'
                          ? content
                          : '',
                        done: event.event === 'conversation.message.completed',
                      })}\n\n`
                    ));
                  }
                }

                // 对话结束
                if (event.event === 'conversation.chat.completed') {
                  writer.write(encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'done',
                      chatId: event.chat?.id || '',
                      conversationId: event.chat?.conversation_id || conversationId,
                    })}\n\n`
                  ));
                }

                // 错误事件
                if (event.event === 'conversation.chat.failed' ||
                    event.event === 'conversation.message.failed') {
                  writer.write(encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      message: event.error?.msg || '智能体处理失败',
                    })}\n\n`
                  ));
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        writer.write(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: '连接中断' })}\n\n`
        ));
      } finally {
        // 记录完整回复（用于学习画像分析）
        if (fullReply) {
          await KV.addLog(env, userId, {
            action: `agent_${agentType}_reply`,
            agentType,
            cost: 0,
            message: fullReply.slice(0, 500),
            page: projectId || '/',
          });
        }
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Credits': spendResult.credits,
      },
    });
  } catch (err) {
    // 退回积分
    await KV.earnCredits(env, userId, meta.cost);
    return Response.json({ error: `请求失败: ${err.message}` }, { status: 500 });
  }
}
