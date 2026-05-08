import Image from "next/image";

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)]">
        <Image
          src="/assets/logo.png"
          alt="ACM Desk"
          width={34}
          height={34}
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
