// 全站页脚：公司全称 + 网站备案号（aifamily.xin 的网站备案号是主体号 -1）
export function SiteFooter({ aboveNav }: { aboveNav: boolean }) {
  return (
    <footer
      className={`px-4 pt-4 text-center text-xs leading-relaxed text-muted-foreground ${
        aboveNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))]" : "pb-[calc(1rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <span>© 2026 深圳市傲客星球教育咨询有限公司</span>
      <span className="mx-1">·</span>
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap hover:text-foreground">
        粤ICP备2026069983号-1
      </a>
    </footer>
  );
}
