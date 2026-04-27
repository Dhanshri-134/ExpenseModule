import Image from "next/image";

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] shadow-[0_10px_30px_rgba(224,33,138,0.16)]">
        <Image
          src="/assets/logo.png"
          alt="ACM Desk"
          width={24}
          height={24}
          priority
        />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-[-0.03em] text-[color:var(--acm-fg)]">
          Project Desk
        </div>
        <div className="text-xs text-[color:var(--acm-muted-fg)]">Workspace Suite</div>
      </div>
    </div>
  );
}
