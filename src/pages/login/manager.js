import RoleLoginPage, { getRoleLoginPageProps } from "@/components/auth/RoleLoginPage";

export default RoleLoginPage;

export async function getServerSideProps(ctx) {
  return getRoleLoginPageProps(ctx, "manager");
}
