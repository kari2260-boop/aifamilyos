"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { BlurFade } from "@/components/ui/blur-fade";

const TOTAL_STEPS = 4;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: 家庭信息
  const [familyName, setFamilyName] = useState("");
  const [city, setCity] = useState("");

  // Step 2: 孩子信息（基础 + 扩展）
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childGrade, setChildGrade] = useState("");
  const [interests, setInterests] = useState("");
  const [challenges, setChallenges] = useState("");
  const [expectations, setExpectations] = useState("");
  const [subjectStrengths, setSubjectStrengths] = useState("");
  const [subjectWeaknesses, setSubjectWeaknesses] = useState("");
  const [learningStyle, setLearningStyle] = useState("");
  const [dailyStudyHours, setDailyStudyHours] = useState("");

  // Step 3: 家长信息
  const [occupation, setOccupation] = useState("");
  const [educationBg, setEducationBg] = useState("");
  const [eduPhilosophy, setEduPhilosophy] = useState("");
  const [commStyle, setCommStyle] = useState("");

  // Step 4: 目标与关系
  const [shortTermGoals, setShortTermGoals] = useState("");
  const [longTermGoals, setLongTermGoals] = useState("");
  const [parentChildQuality, setParentChildQuality] = useState("");
  const [eduConcerns, setEduConcerns] = useState("");

  const handleSubmit = async () => {
    if (step <= 2 && !familyName.trim()) { setError("请填写家庭名称"); return; }
    if (step <= 2 && !childName.trim()) { setError("请填写孩子姓名"); return; }

    setLoading(true);
    setError("");

    try {
      // Step 1+2: 创建家庭和孩子
      if (initialStep <= 1) {
        await api.createFamily({ family_name: familyName.trim(), city: city.trim() || undefined });
        const child = await api.createChild({
          name: childName.trim(),
          age: childAge ? Number(childAge) : undefined,
          grade: childGrade.trim() || undefined,
          interests: interests.trim() || undefined,
          learning_challenges: challenges.trim() || undefined,
          parent_expectations: expectations.trim() || undefined,
        });
        // 扩展信息
        if (child?.id && (subjectStrengths || subjectWeaknesses || learningStyle || dailyStudyHours)) {
          await api.updateChildExtended(child.id, {
            subject_strengths: subjectStrengths ? subjectStrengths.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
            subject_weaknesses: subjectWeaknesses ? subjectWeaknesses.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
            learning_style: learningStyle || undefined,
            daily_study_hours: dailyStudyHours ? Number(dailyStudyHours) : undefined,
          }).catch(() => {});
        }
      }

      // Step 3: 家长档案
      if (occupation || educationBg || eduPhilosophy || commStyle || parentChildQuality || eduConcerns) {
        await api.saveParentProfile({
          occupation: occupation.trim() || undefined,
          education_background: educationBg.trim() || undefined,
          education_philosophy: eduPhilosophy.trim() || undefined,
          communication_style: commStyle || undefined,
          parent_child_quality: parentChildQuality || undefined,
          education_concerns: eduConcerns.trim() || undefined,
        }).catch(() => {});
      }

      // Step 4: 目标（存到孩子扩展信息）
      if (shortTermGoals || longTermGoals) {
        const children = await api.getChildren().catch(() => []);
        if (children?.[0]?.id) {
          await api.updateChildExtended(children[0].id, {
            short_term_goals: shortTermGoals.trim() || undefined,
            long_term_goals: longTermGoals.trim() || undefined,
          }).catch(() => {});
        }
      }

      router.push("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !familyName.trim()) { setError("请填写家庭名称"); return; }
    if (step === 2 && !childName.trim()) { setError("请填写孩子姓名"); return; }
    setError("");
    setStep(step + 1);
  };

  const skipStep = () => { setError(""); setStep(step + 1); };

  const inputClass = "w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";
  const selectClass = "w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition";

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background px-5 py-12">
        <BlurFade delay={0.1}>
          <div className="mb-6">
            {/* 步骤指示器 */}
            <div className="flex items-center gap-2 mb-4">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium">第 {step} 步 / 共 {TOTAL_STEPS} 步</span>
            <h1 className="text-xl font-bold text-foreground mt-2">
              {step === 1 && "家庭基本信息"}
              {step === 2 && "孩子信息"}
              {step === 3 && "家长信息"}
              {step === 4 && "目标与关系"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 1 && "让我们先了解你的家庭"}
              {step === 2 && "告诉我们孩子的情况，AI 会更懂 TA"}
              {step === 3 && "了解家长背景，提供更贴合的建议"}
              {step === 4 && "明确目标，让成长有方向"}
            </p>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <div className="bg-card rounded-2xl shadow-sm p-5">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">家庭名称 *</label>
                  <input className={inputClass} value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="例如：小明家" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">所在城市</label>
                  <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="例如：深圳" />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <button onClick={nextStep} className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium shadow-sm hover:opacity-90 transition">
                  下一步
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">孩子姓名 *</label>
                  <input className={inputClass} value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="孩子的名字或昵称" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">年龄</label>
                    <input type="number" className={inputClass} value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder="岁" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">年级</label>
                    <input className={inputClass} value={childGrade} onChange={(e) => setChildGrade(e.target.value)} placeholder="例如：初二" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">兴趣爱好</label>
                  <textarea className={inputClass} value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="孩子喜欢什么？" rows={2} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">学科优势（逗号分隔）</label>
                  <input className={inputClass} value={subjectStrengths} onChange={(e) => setSubjectStrengths(e.target.value)} placeholder="例如：数学，英语" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">学科弱项（逗号分隔）</label>
                  <input className={inputClass} value={subjectWeaknesses} onChange={(e) => setSubjectWeaknesses(e.target.value)} placeholder="例如：语文，物理" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">学习风格</label>
                  <select className={selectClass} value={learningStyle} onChange={(e) => setLearningStyle(e.target.value)}>
                    <option value="">请选择</option>
                    <option value="visual">视觉型（看图表、视频）</option>
                    <option value="auditory">听觉型（听讲、讨论）</option>
                    <option value="kinesthetic">动手型（实验、操作）</option>
                    <option value="reading">阅读型（看书、笔记）</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">每日学习时长（小时）</label>
                  <input type="number" step="0.5" className={inputClass} value={dailyStudyHours} onChange={(e) => setDailyStudyHours(e.target.value)} placeholder="例如：2" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">学习卡点</label>
                  <textarea className={inputClass} value={challenges} onChange={(e) => setChallenges(e.target.value)} placeholder="目前学习上遇到的困难" rows={2} />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 bg-muted text-foreground py-3 rounded-xl text-sm font-medium">上一步</button>
                  <button onClick={nextStep} className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-medium shadow-sm">下一步</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">职业</label>
                  <input className={inputClass} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="例如：产品经理" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">学历背景</label>
                  <input className={inputClass} value={educationBg} onChange={(e) => setEducationBg(e.target.value)} placeholder="例如：硕士" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">教育理念</label>
                  <textarea className={inputClass} value={eduPhilosophy} onChange={(e) => setEduPhilosophy(e.target.value)} placeholder="你认为好的教育是什么样的？" rows={3} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">沟通风格</label>
                  <select className={selectClass} value={commStyle} onChange={(e) => setCommStyle(e.target.value)}>
                    <option value="">请选择</option>
                    <option value="democratic">民主型（平等讨论、共同决策）</option>
                    <option value="authoritative">权威型（有规则、有引导）</option>
                    <option value="permissive">放任型（给孩子充分自由）</option>
                  </select>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 bg-muted text-foreground py-3 rounded-xl text-sm font-medium">上一步</button>
                  <button onClick={skipStep} className="text-xs text-muted-foreground self-center">跳过</button>
                  <button onClick={nextStep} className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-medium shadow-sm">下一步</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">短期目标（本学期）</label>
                  <textarea className={inputClass} value={shortTermGoals} onChange={(e) => setShortTermGoals(e.target.value)} placeholder="这学期希望孩子达成什么？" rows={2} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">长期规划</label>
                  <textarea className={inputClass} value={longTermGoals} onChange={(e) => setLongTermGoals(e.target.value)} placeholder="教育方向、升学目标等" rows={2} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">亲子关系质量</label>
                  <select className={selectClass} value={parentChildQuality} onChange={(e) => setParentChildQuality(e.target.value)}>
                    <option value="">请选择</option>
                    <option value="excellent">很好（沟通顺畅、互相信任）</option>
                    <option value="good">良好（偶有摩擦、整体和谐）</option>
                    <option value="average">一般（沟通不多、各忙各的）</option>
                    <option value="needs_improvement">需改善（冲突较多、缺乏理解）</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">当前最大的教育困惑</label>
                  <textarea className={inputClass} value={eduConcerns} onChange={(e) => setEduConcerns(e.target.value)} placeholder="你最想解决的教育问题是什么？" rows={3} />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 bg-muted text-foreground py-3 rounded-xl text-sm font-medium">上一步</button>
                  <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 shadow-sm">
                    {loading ? "保存中..." : "完成"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </BlurFade>
      </div>
    </AuthGuard>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-sm">加载中...</p></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
