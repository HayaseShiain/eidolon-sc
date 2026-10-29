import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/i18n";

/** 找不到的地址：静态导出成 404.html。演示站原来的应用地址由 vercel.json 送回首页，到不了这里。 */
export default function NotFound() {
  return (
    <div className="lp-root">
      <main className="lp-act6">
        <div className="lp-act6-text">
          <h1 className="lp-act-title">{copy.notFound.title}</h1>
          <a href="/" className={buttonVariants({ variant: "outline" })}>
            {copy.notFound.home}
          </a>
        </div>
      </main>
    </div>
  );
}
