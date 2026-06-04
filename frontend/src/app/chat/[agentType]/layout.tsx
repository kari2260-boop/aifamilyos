import { Metadata } from "next";

type Props = {
  params: Promise<{ agentType: string }>;
  children: React.ReactNode;
};

const agentMetadata: Record<string, { title: string; description: string; image: string }> = {
  xuexue: {
    title: "学学 — 学习策略师 | AI未来家庭",
    description: "自己走过厌学，最懂「努力了没用」的感觉。帮孩子找到适合自己的学习节奏，不再死磕错误方法。",
    image: "/agents/xuexue.png",
  },
  chuangchuang: {
    title: "创创 — 创造引导师 | AI未来家庭",
    description: "从小被说不务正业，现在帮孩子找到眼睛发光的事。把兴趣变成真实作品，让创造力看得见。",
    image: "/agents/chuangchuang.png",
  },
  tantan: {
    title: "探探 — 天赋测评师 | AI未来家庭",
    description: "见过太多孩子被埋没，现在帮家长发现孩子真正的天赋。从日常行为里找到潜力方向，不再盲目报班。",
    image: "/agents/tantan.png",
  },
  banban: {
    title: "伴伴 — 成长陪伴师 | AI未来家庭",
    description: "经历过家庭撕裂，最懂「我已经很努力了」的无力感。帮家长和孩子重新建立连接，让陪伴不再是负担。",
    image: "/agents/banban.png",
  },
  shuashua: {
    title: "刷刷 — 真题训练与错题复盘 | AI未来家庭",
    description: "题海战术受害者，后来靠错题复盘逆袭。帮孩子把错题变成学习资产，中考真题讲解 + 类似题训练。",
    image: "/agents/shuashua.png",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentType } = await params;
  const meta = agentMetadata[agentType] || agentMetadata.xuexue;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: `https://aifamily.xin/chat/${agentType}`,
      siteName: "AI未来家庭",
      title: meta.title,
      description: meta.description,
      images: [
        {
          url: `https://aifamily.xin${meta.image}`,
          width: 800,
          height: 800,
          alt: meta.title,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
      images: [`https://aifamily.xin${meta.image}`],
    },
  };
}

export default function ChatAgentLayout({ children }: Props) {
  return <>{children}</>;
}
