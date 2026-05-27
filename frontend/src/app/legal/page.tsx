"use client";

import { useState } from "react";
import Link from "next/link";

const tabs = [
  { id: "service", label: "服务协议" },
  { id: "privacy", label: "隐私政策" },
  { id: "minor", label: "未成年人保护" },
];

const content: Record<string, string> = {
  service: `# AI家庭成长OS 用户服务协议

更新日期：2026年5月

## 一、服务说明

AI家庭成长OS（以下简称"本平台"）是由深圳市格勤朝夕科技有限公司运营的AI教育陪伴服务平台，为8-18岁青少年家庭提供AI学习辅导、成长测评、专家咨询等服务。

## 二、用户注册与账号

1. 用户需年满18周岁方可注册账号。未成年人使用本平台需在监护人同意和监督下进行。
2. 用户应提供真实、准确的注册信息。
3. 用户应妥善保管账号密码，因账号密码泄露造成的损失由用户自行承担。

## 三、服务内容

1. AI智能对话：4个AI教育助手提供学习、创造、天赋、陪伴等方面的建议。
2. 成长测评：在线测评问卷及AI辅助分析报告。
3. 专家咨询：一对一或专家咨询预约服务。
4. 课程学习：视频课程和文章内容。
5. 成长报告：基于使用数据生成的月度成长分析。

## 四、AI内容免责声明

1. 本平台AI生成的内容仅供参考，不构成专业医疗、心理、法律建议。
2. AI回复基于算法生成，可能存在不准确或不完整的情况。
3. 涉及孩子身心健康的重要决策，请咨询专业人士。

## 五、付费服务

1. 本平台提供免费和付费服务。付费服务的具体内容和价格以页面展示为准。
2. 付费后如需退款，请在7个工作日内联系客服处理。

## 六、用户行为规范

1. 不得利用本平台从事违法违规活动。
2. 不得发布有害、暴力、色情等不当内容。
3. 不得干扰平台正常运营。

## 七、知识产权

本平台的所有内容（包括但不限于文字、图片、音视频、软件）的知识产权归本公司所有。

## 八、账号注销

用户可在"我的"页面申请注销账号。注销后，账号数据将在30日内删除。

## 九、联系方式

如有问题，请联系：kari_guo@hotmail.com`,

  privacy: `# 隐私政策

更新日期：2026年5月

## 一、信息收集

我们收集以下信息：
1. 注册信息：手机号、密码（加密存储）
2. 家庭信息：家庭名称、城市、孩子姓名/年龄/年级/兴趣
3. 使用数据：对话记录、测评结果、课程学习进度
4. 设备信息：浏览器类型、操作系统（用于优化体验）

## 二、信息使用

我们使用收集的信息用于：
1. 提供和改进AI教育服务
2. 生成个性化的学习建议和成长报告
3. 保障平台安全和风险识别
4. 发送服务通知

## 三、信息存储与安全

1. 数据存储在中国大陆的云服务器上。
2. 我们采用加密传输、访问控制等措施保护数据安全。
3. 对话数据保留期限为服务期间及服务结束后30天。

## 四、信息共享

我们不会将用户个人信息出售给第三方。以下情况除外：
1. 获得用户明确同意
2. 法律法规要求
3. 保护用户或公众安全

## 五、未成年人信息保护

1. 我们高度重视未成年人信息保护。
2. 收集未成年人信息前，需获得监护人同意。
3. 未成年人的对话数据受到额外的安全保护。

## 六、用户权利

您有权：
1. 查看和修改个人信息
2. 删除个人数据
3. 注销账号
4. 撤回同意

## 七、联系我们

隐私相关问题请联系：kari_guo@hotmail.com`,

  minor: `# 未成年人个人信息保护规则

更新日期：2026年5月

## 一、适用范围

本规则适用于本平台收集、使用、存储8-18岁未成年人个人信息的行为。

## 二、监护人同意

1. 未成年人使用本平台，需由监护人注册账号并同意本规则。
2. 监护人有权随时查看、修改、删除未成年人的个人信息。
3. 监护人可通过"我的"页面管理孩子档案。

## 三、信息收集最小化

我们仅收集提供服务所必需的未成年人信息：
- 姓名（或昵称）、年龄、年级
- 学习兴趣和风格
- 对话内容（用于AI个性化服务）
- 测评结果

## 四、特殊保护措施

1. 未成年人对话内容受风险识别系统保护，检测到自伤、暴力等风险信号时自动预警。
2. AI回复遵循教育适宜性原则，不提供不适合未成年人的内容。
3. 未成年人数据不用于商业营销。

## 五、数据删除

监护人可随时要求删除未成年人的全部数据，我们将在15个工作日内完成删除。

## 六、投诉举报

如发现本平台存在侵害未成年人权益的行为，请联系：kari_guo@hotmail.com
我们将在24小时内响应，3个工作日内处理完毕。`,
};

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState("service");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="text-muted-foreground text-sm mb-4 inline-block">‹ 返回首页</Link>

        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="prose prose-sm max-w-none text-foreground">
          {content[activeTab].split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
            if (line.startsWith("- ")) return <li key={i} className="text-sm text-muted-foreground ml-4">{line.slice(2)}</li>;
            if (line.match(/^\d+\./)) return <p key={i} className="text-sm text-muted-foreground ml-2 mb-1">{line}</p>;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-sm text-muted-foreground mb-1">{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}
