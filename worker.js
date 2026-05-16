// worker.js
var worker_default = {
  async fetch(request, env) {
    // 1. 仅允许 POST 请求
    if (request.method !== "POST") {
      return new Response("请使用 POST 请求发送告警数据", { status: 405 });
    }

    try {
      const data = await request.json();
      const feishuWebhook = env.FEISHU_WEBHOOK;

      // 防御性校验：确保有告警数据
      if (!data.alerts || data.alerts.length === 0) {
        return new Response("未检测到有效的 alerts 数据", { status: 400 });
      }

      const status = data.status;
      const isResolved = status === "resolved";
      
      // 2. 循环遍历所有的 alerts，组装飞书卡片的 fields
      const alertFields = [];
      data.alerts.forEach((alert, index) => {
        const alertName = alert.labels.alertname || "未知告警";
        const severity = alert.labels.severity || "warning";
        const summary = alert.annotations.summary || "无摘要";
        
        // 转换时间动作为东八区（上海时间）
        const startsAt = new Date(alert.startsAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

        // 将每个告警的信息格式化后推入数组
        alertFields.push(
          { 
            is_short: false, 
            text: { tag: "lark_md", content: `**告警 [${index + 1}]:** ${alertName} (${severity.toUpperCase()})` } 
          },
          { 
            is_short: false, 
            text: { tag: "lark_md", content: `**描述:** ${summary}` } 
          },
          { 
            is_short: false, 
            text: { tag: "lark_md", content: `**触发时间:** ${startsAt}\n--------------------------------------` } 
          }
        );
      });

      // 3. 基于首条告警和整体状态定义卡片的主题与标题
      const firstAlert = data.alerts[0];
      const mainAlertName = firstAlert.labels.alertname || "集群动态";
      const mainSeverity = firstAlert.labels.severity || "warning";

      // 状态颜色：已恢复 -> 绿色；严重 -> 红色；普通警告 -> 橙色
      const theme = isResolved ? "green" : mainSeverity === "critical" ? "red" : "orange";
      const title = isResolved ? `✅ [已恢复] ${mainAlertName}` : `🔥 [告警中] ${mainAlertName}`;

      // 4. 构建完整的飞书交互式卡片结构
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
              fields: alertFields // 注入上面循环生成的告警列表
            },
            {
              tag: "note",
              elements: [
                { 
                  tag: "plain_text", 
                  content: `状态: ${status.toUpperCase()} | 本批次包含 ${data.alerts.length} 个事件 | Webhook 机器人 🤖` 
                }
              ]
            }
          ]
        }
      };

      // 5. 转发请求至飞书机器人
      const response = await fetch(feishuWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`飞书 API 返回错误: ${errorText}`);
      }

      return new Response("告警已成功转发至飞书", { status: 200 });

    } catch (err) {
      // 异常捕获
      return new Response("解析或转发失败: " + err.message, { status: 500 });
    }
  }
};

export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
