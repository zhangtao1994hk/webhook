export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('请使用 POST 请求发送告警数据', { status: 405 });
    }

    try {
      const data = await request.json();
      const feishuWebhook = env.FEISHU_WEBHOOK; // 在云端设置你的飞书机器人地址

      // 1. 提取告警信息
      const alert = data.alerts[0]; // 取第一个告警作为示例
      const status = data.status; // 'firing' 或 'resolved'
      const alertName = alert.labels.alertname || "未知告警";
      const severity = alert.labels.severity || "warning";
      const summary = alert.annotations.summary || "无摘要";
      const startsAt = new Date(alert.startsAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

      // 2. 根据状态定义卡片颜色和标题
      const isResolved = status === 'resolved';
      const theme = isResolved ? "green" : (severity === 'critical' ? "red" : "orange");
      const title = isResolved ? `✅ [已恢复] ${alertName}` : `🔥 [告警中] ${alertName}`;

      // 3. 构建飞书卡片 JSON
      const card = {
        msg_type: "interactive",
        card: {
          config: { wide_screen_mode: true },
          header: {
            template: theme,
            title: { content: title, tag: "plain_text" }
          },
          elements: [
            {
              tag: "div",
              fields: [
                { is_short: true, text: { tag: "lark_md", content: `**状态:** ${status.toUpperCase()}` } },
                { is_short: true, text: { tag: "lark_md", content: `**等级:** ${severity}` } },
                { is_short: false, text: { tag: "lark_md", content: `**开始时间:** ${startsAt}` } },
                { is_short: false, text: { tag: "lark_md", content: `**描述:** ${summary}` } }
              ]
            },
            {
              tag: "note",
              elements: [{ tag: "plain_text", content: "webhook 报警机器人🤖" }]
            }
          ]
        }
      };

      // 4. 转发给飞书
      await fetch(feishuWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card)
      });

      return new Response('告警已转发至飞书', { status: 200 });
    } catch (err) {
      return new Response('解析失败: ' + err.message, { status: 500 });
    }
  }
};
