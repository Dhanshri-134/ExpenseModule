import { requireRolePage } from "@/lib/pages/requireRolePage";

export async function requireOwner(ctx) {
  const result = await requireRolePage(ctx, ["owner"]);
  if (!result.props?.authContext) return result;

  return {
    props: {
      supabaseConfigured: true,
      companyName: result.props.authContext.company.name,
      viewer: result.props.authContext.viewer,
    },
  };
}

