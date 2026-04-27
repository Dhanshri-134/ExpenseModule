import Link from "next/link";

export default function LoginIndexPage() {
  return (
    <div className="min-h-screen acm-app">
      <div className="acm-container py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
        <p className="mt-3 text-[color:var(--acm-fg)]/70">
          Choose a role to continue.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/login/owner" className="acm-btn acm-btn-primary acm-btn-lift">
            Continue as Owner
          </Link>
          <Link
            href="/login/manager"
            className="acm-btn acm-btn-secondary acm-btn-lift"
          >
            Continue as Manager
          </Link>
          <Link
            href="/login/employee"
            className="acm-btn acm-btn-employee acm-btn-lift"
          >
            Continue as Employee
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const role = typeof ctx.query.role === "string" ? ctx.query.role.toLowerCase() : "";
  if (role === "owner" || role === "manager" || role === "employee") {
    return {
      redirect: {
        destination: `/login/${role}`,
        permanent: false,
      },
    };
  }
  return { props: {} };
}

